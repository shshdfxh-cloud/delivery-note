@echo off
cd /d "%~dp0"
python -m delivery_note.app --agent-review --max-calls 3
pause
