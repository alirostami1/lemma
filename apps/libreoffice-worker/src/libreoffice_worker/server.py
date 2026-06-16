import json
import os
import shutil
import signal
import subprocess
import tempfile
import time
import traceback
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import uno
from com.sun.star.beans import PropertyValue
from com.sun.star.connection import NoConnectException
from com.sun.star.document.MacroExecMode import NEVER_EXECUTE
from com.sun.star.document.UpdateDocMode import NO_UPDATE


HOST = os.environ.get("WORKBOOK_WORKER_HOST", "127.0.0.1")
PORT = int(os.environ.get("WORKBOOK_WORKER_PORT", "8080"))
SOFFICE = os.environ.get("WORKBOOK_LIBREOFFICE_PATH", "/usr/bin/soffice")
MAX_UPLOAD_BYTES = int(
    os.environ.get("WORKBOOK_WORKER_MAX_UPLOAD_BYTES", str(20 * 1024 * 1024))
)
MAX_RESPONSE_BYTES = int(
    os.environ.get("WORKBOOK_WORKER_MAX_RESPONSE_BYTES", str(10 * 1024 * 1024))
)
MAX_BATCH_COUNT = int(os.environ.get("WORKBOOK_WORKER_MAX_BATCH_COUNT", "1000"))
CALCULATE_TIMEOUT_SECONDS = float(
    os.environ.get("WORKBOOK_WORKER_TIMEOUT_SECONDS", "30")
)
SHARED_SECRET = os.environ.get("WORKBOOK_WORKER_SHARED_SECRET")


def log(level, event, **fields):
    record = {
        "level": level,
        "event": event,
        "time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        **fields,
    }
    print(json.dumps(record, separators=(",", ":"), sort_keys=True), flush=True)


def prop(name, value):
    item = PropertyValue()
    item.Name = name
    item.Value = value
    return item


class LibreOfficeSession:
    def __init__(self):
        self.workspace = Path(tempfile.mkdtemp(prefix="lemma-lo-worker-"))
        self.profile = self.workspace / "profile"
        self.pipe_name = f"lemma-{os.getpid()}"
        self.process = None
        self.desktop = None

    def start(self):
        started = time.monotonic()
        log(
            "info",
            "libreoffice.start",
            pipeName=self.pipe_name,
            profilePath=str(self.profile),
            soffice=SOFFICE,
        )
        self.profile.mkdir(parents=True, exist_ok=True)
        accept = f"pipe,name={self.pipe_name};urp;StarOffice.ComponentContext"
        self.process = subprocess.Popen(
            [
                SOFFICE,
                "--headless",
                "--nologo",
                "--nofirststartwizard",
                "--norestore",
                "--nodefault",
                f"-env:UserInstallation={self.profile.as_uri()}",
                f"--accept={accept}",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        local_context = uno.getComponentContext()
        resolver = local_context.ServiceManager.createInstanceWithContext(
            "com.sun.star.bridge.UnoUrlResolver",
            local_context,
        )
        deadline = time.monotonic() + 10
        while True:
            try:
                context = resolver.resolve(
                    f"uno:pipe,name={self.pipe_name};urp;StarOffice.ComponentContext"
                )
                self.desktop = context.ServiceManager.createInstanceWithContext(
                    "com.sun.star.frame.Desktop",
                    context,
                )
                log(
                    "info",
                    "libreoffice.ready",
                    durationMs=elapsed_ms(started),
                    pipeName=self.pipe_name,
                )
                return
            except NoConnectException:
                if time.monotonic() > deadline:
                    log(
                        "error",
                        "libreoffice.start_timeout",
                        durationMs=elapsed_ms(started),
                        pipeName=self.pipe_name,
                    )
                    raise TimeoutError("LibreOffice UNO pipe did not become ready.")
                time.sleep(0.1)

    def stop(self):
        started = time.monotonic()
        log("info", "libreoffice.stop", pipeName=self.pipe_name)
        if self.desktop is not None:
            try:
                self.desktop.terminate()
            except Exception:
                pass
        if self.process is not None:
            try:
                self.process.terminate()
                self.process.wait(timeout=5)
            except Exception:
                self.process.kill()
        shutil.rmtree(self.workspace, ignore_errors=True)
        log(
            "info",
            "libreoffice.stopped",
            durationMs=elapsed_ms(started),
            pipeName=self.pipe_name,
        )

    def calculate(self, workbook_bytes):
        started = time.monotonic()
        request_dir = Path(tempfile.mkdtemp(prefix="lemma-lo-calc-"))
        workbook_path = request_dir / "workbook.xlsx"
        document = None
        try:
            workbook_path.write_bytes(workbook_bytes)
            log(
                "info",
                "workbook.load",
                byteSize=len(workbook_bytes),
                tempDir=str(request_dir),
            )
            url = uno.systemPathToFileUrl(str(workbook_path))
            document = self.desktop.loadComponentFromURL(
                url,
                "_blank",
                0,
                (
                    prop("Hidden", True),
                    prop("ReadOnly", True),
                    prop("MacroExecutionMode", NEVER_EXECUTE),
                    prop("UpdateDocMode", NO_UPDATE),
                ),
            )
            if document is None:
                raise ValueError("LibreOffice could not load workbook.")
            document.calculateAll()
            values = extract_values(document)
            log(
                "info",
                "workbook.calculated",
                durationMs=elapsed_ms(started),
                sheetCount=len(values["sheets"]),
            )
            return values
        finally:
            if document is not None:
                try:
                    document.close(True)
                except Exception:
                    document.dispose()
            shutil.rmtree(request_dir, ignore_errors=True)
            log("info", "workbook.cleanup", tempDir=str(request_dir))

    def calculate_batch(self, workbook_bytes, count):
        started = time.monotonic()
        request_dir = Path(tempfile.mkdtemp(prefix="lemma-lo-calc-"))
        workbook_path = request_dir / "workbook.xlsx"
        document = None
        try:
            workbook_path.write_bytes(workbook_bytes)
            log(
                "info",
                "workbook.batch_load",
                byteSize=len(workbook_bytes),
                count=count,
                tempDir=str(request_dir),
            )
            url = uno.systemPathToFileUrl(str(workbook_path))
            document = self.desktop.loadComponentFromURL(
                url,
                "_blank",
                0,
                (
                    prop("Hidden", True),
                    prop("ReadOnly", True),
                    prop("MacroExecutionMode", NEVER_EXECUTE),
                    prop("UpdateDocMode", NO_UPDATE),
                ),
            )
            if document is None:
                raise ValueError("LibreOffice could not load workbook.")
            snapshots = []
            for index in range(count):
                document.calculateAll()
                snapshots.append(extract_values(document))
                log(
                    "info",
                    "workbook.batch_calculated",
                    index=index + 1,
                    count=count,
                )
            log(
                "info",
                "workbook.batch_complete",
                count=count,
                durationMs=elapsed_ms(started),
            )
            return {"snapshots": snapshots}
        finally:
            if document is not None:
                try:
                    document.close(True)
                except Exception:
                    document.dispose()
            shutil.rmtree(request_dir, ignore_errors=True)
            log("info", "workbook.cleanup", tempDir=str(request_dir))


def extract_values(document):
    sheets = []
    spreadsheet_sheets = document.getSheets()
    for index in range(spreadsheet_sheets.getCount()):
        sheet = spreadsheet_sheets.getByIndex(index)
        cursor = sheet.createCursor()
        cursor.gotoEndOfUsedArea(True)
        used = cursor.getRangeAddress()
        cells = {}
        row_count = max(0, used.EndRow + 1)
        column_count = max(0, used.EndColumn + 1)
        for row in range(row_count):
            for column in range(column_count):
                value = sheet.getCellByPosition(column, row).getString()
                if value != "":
                    cells[a1(column, row)] = value
        sheets.append(
            {
                "name": sheet.getName(),
                "cells": cells,
                "rowCount": row_count,
                "columnCount": column_count,
            }
        )
    return {"sheets": sheets}


def a1(column, row):
    name = ""
    index = column + 1
    while index:
        index, remainder = divmod(index - 1, 26)
        name = chr(65 + remainder) + name
    return f"{name}{row + 1}"


class Handler(BaseHTTPRequestHandler):
    session = LibreOfficeSession()

    def do_GET(self):
        request_started = time.monotonic()
        request_id = self.request_id()
        if not self.authorized(request_id):
            return
        if urlparse(self.path).path not in ("/v1/health", "/health"):
            log("warn", "http.not_found", method="GET", path=self.path, requestId=request_id)
            self.send_error_json("not_found", "not found", 404, request_id)
            return
        version = libreoffice_version()
        self.send_json({"ok": True, "version": version}, request_id=request_id)
        log(
            "info",
            "http.health",
            durationMs=elapsed_ms(request_started),
            status=200,
            requestId=request_id,
            version=version,
        )

    def do_POST(self):
        request_started = time.monotonic()
        request_id = self.request_id()
        if not self.authorized(request_id):
            return
        parsed_url = urlparse(self.path)
        if parsed_url.path not in (
            "/v1/calculations",
            "/v1/batch-calculations",
            "/calculate",
            "/calculate-batch",
        ):
            log("warn", "http.not_found", method="POST", path=self.path, requestId=request_id)
            self.send_error_json("not_found", "not found", 404, request_id)
            return
        length = self.headers.get("content-length")
        if length is None:
            log("warn", "workbook.rejected", reason="missing_content_length", requestId=request_id)
            self.send_error_json("missing_content_length", "content-length is required", 411, request_id)
            return
        try:
            size = int(length)
        except ValueError:
            log("warn", "workbook.rejected", reason="invalid_content_length", requestId=request_id)
            self.send_error_json("invalid_content_length", "content-length is invalid", 400, request_id)
            return
        if size > MAX_UPLOAD_BYTES:
            log(
                "warn",
                "workbook.rejected",
                byteSize=size,
                maxUploadBytes=MAX_UPLOAD_BYTES,
                reason="upload_too_large",
                requestId=request_id,
            )
            self.send_error_json("upload_too_large", "workbook upload is too large", 413, request_id)
            return
        started = time.monotonic()
        body = self.rfile.read(size)
        count = 1
        if parsed_url.path in ("/v1/batch-calculations", "/calculate-batch"):
            count = parse_batch_count(parsed_url.query)
            if count < 1 or count > MAX_BATCH_COUNT:
                log(
                    "warn",
                    "workbook.rejected",
                    count=count,
                    maxBatchCount=MAX_BATCH_COUNT,
                    reason="invalid_batch_count",
                    requestId=request_id,
                )
                self.send_error_json("invalid_batch_count", "batch count is invalid", 400, request_id)
                return
        log("info", "workbook.calculate_start", byteSize=size, count=count, requestId=request_id)
        try:
            with calculation_timeout(started, count):
                if parsed_url.path in ("/v1/batch-calculations", "/calculate-batch"):
                    result = type(self).session.calculate_batch(body, count)
                else:
                    result = type(self).session.calculate(body)
            self.send_json(result, request_id=request_id)
            log(
                "info",
                "workbook.calculate_success",
                byteSize=size,
                count=count,
                durationMs=elapsed_ms(request_started),
                status=200,
                requestId=request_id,
            )
        except TimeoutError:
            log(
                "error",
                "workbook.calculate_timeout",
                byteSize=size,
                count=count,
                durationMs=elapsed_ms(request_started),
                requestId=request_id,
            )
            type(self).session.stop()
            type(self).session = LibreOfficeSession()
            type(self).session.start()
            self.send_error_json("calculation_timeout", "calculation timed out", 504, request_id)
        except Exception as error:
            log_exception(
                "workbook.calculate_error",
                error,
                byteSize=size,
                count=count,
                durationMs=elapsed_ms(request_started),
                requestId=request_id,
            )
            self.send_error_json("calculation_failed", str(error), 500, request_id)

    def request_id(self):
        return self.headers.get("x-request-id")

    def authorized(self, request_id):
        if not SHARED_SECRET:
            return True
        auth = self.headers.get("authorization", "")
        header_secret = self.headers.get("x-worker-secret")
        if auth == f"Bearer {SHARED_SECRET}" or header_secret == SHARED_SECRET:
            return True
        log("warn", "http.unauthorized", requestId=request_id)
        self.send_error_json("unauthorized", "unauthorized", 401, request_id)
        return False

    def send_error_json(self, code, message, status, request_id=None):
        self.send_json(
            {"error": {"code": code, "message": message, "requestId": request_id}},
            status=status,
            request_id=request_id,
        )

    def send_json(self, value, status=200, request_id=None):
        body = json.dumps(value, separators=(",", ":")).encode("utf-8")
        if len(body) > MAX_RESPONSE_BYTES:
            log(
                "error",
                "http.response_too_large",
                maxResponseBytes=MAX_RESPONSE_BYTES,
                responseBytes=len(body),
                requestId=request_id,
            )
            body = json.dumps(
                {
                    "error": {
                        "code": "response_too_large",
                        "message": "response is too large",
                        "requestId": request_id,
                    }
                },
                separators=(",", ":"),
            ).encode("utf-8")
            status = 507
        self.send_response(status)
        if request_id:
            self.send_header("x-request-id", request_id)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        return


def libreoffice_version():
    try:
        completed = subprocess.run(
            [SOFFICE, "--version"],
            check=False,
            capture_output=True,
            text=True,
            timeout=5,
        )
        return (completed.stdout or completed.stderr).strip() or None
    except Exception as error:
        log_exception("libreoffice.version_error", error)
        return None


def parse_batch_count(query):
    params = parse_qs(query)
    try:
        return int(params.get("count", ["1"])[0])
    except (TypeError, ValueError):
        return 0


class calculation_timeout:
    def __init__(self, started, multiplier=1):
        self.remaining = max(
            1,
            (CALCULATE_TIMEOUT_SECONDS * multiplier)
            - (time.monotonic() - started),
        )

    def __enter__(self):
        signal.signal(signal.SIGALRM, self._timeout)
        signal.setitimer(signal.ITIMER_REAL, self.remaining)

    def __exit__(self, exc_type, exc, traceback):
        signal.setitimer(signal.ITIMER_REAL, 0)
        return False

    def _timeout(self, signum, frame):
        raise TimeoutError("LibreOffice calculation timed out.")


def elapsed_ms(started):
    return round((time.monotonic() - started) * 1000)


def log_exception(event, error, **fields):
    log(
        "error",
        event,
        errorType=type(error).__name__,
        errorMessage=str(error),
        traceback="".join(traceback.format_exception(error)).strip(),
        **fields,
    )


def main():
    log(
        "info",
        "worker.start",
        host=HOST,
        port=PORT,
        maxUploadBytes=MAX_UPLOAD_BYTES,
        maxResponseBytes=MAX_RESPONSE_BYTES,
        maxBatchCount=MAX_BATCH_COUNT,
        timeoutSeconds=CALCULATE_TIMEOUT_SECONDS,
    )
    Handler.session.start()
    server = HTTPServer((HOST, PORT), Handler)
    try:
        server.serve_forever()
    finally:
        log("info", "worker.stop")
        server.server_close()
        Handler.session.stop()


if __name__ == "__main__":
    main()
