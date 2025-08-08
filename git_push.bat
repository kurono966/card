@echo off
echo Staging all changes...
git add .

echo.
set /p commitMessage="Enter commit message: "

echo.
echo Committing changes with message: "%commitMessage%"
git commit -m "%commitMessage%"

echo.
echo Pushing changes to remote repository...
git push origin master

echo.
echo Git operations complete.
pause