@echo off
cd /d "%~dp0"
echo Delivery Note local review: http://127.0.0.1:8766
echo AI provider calls are disabled in this launcher.
python -m delivery_note.app --port 8766 --max-calls 0
pause
