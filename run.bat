@echo off
start http://127.0.0.1:8082
python -m http.server 8082
pause