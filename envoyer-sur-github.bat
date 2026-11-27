@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo ===============================================
echo   Envoi de Konekte vers GitHub
echo   Michaeljacques-ht/Konekte
echo ===============================================
echo.

if not exist "server.js" (
  echo ERREUR : server.js est introuvable dans ce dossier.
  echo Placez ce fichier a cote de server.js, package.json, lib et public.
  echo.
  pause
  exit /b
)

git --version >nul 2>&1
if errorlevel 1 (
  echo ERREUR : Git n'est pas installe.
  echo https://git-scm.com/download/win
  echo.
  pause
  exit /b
)

rem ---------------------------------------------------------------
rem  [1/6] Depot local
rem
rem  La presence du dossier .git ne prouve rien : OneDrive le
rem  synchronise comme n'importe quel dossier, et il lui arrive de
rem  n'en recopier qu'une partie. On se retrouve alors avec un .git
rem  bien visible que Git refuse de reconnaitre -- c'est le message
rem  "not a git repository" alors que le script venait d'annoncer
rem  "depot deja present".
rem
rem  On interroge donc Git lui-meme. S'il ne reconnait pas le depot,
rem  on repart d'un depot neuf : ce script renvoie de toute facon le
rem  dossier entier par-dessus GitHub, l'historique local ne sert a
rem  rien ici, et celui qui est deja sur GitHub n'est pas touche.
rem ---------------------------------------------------------------
echo [1/6] Depot local...
set "GITDIR="
for /f "delims=" %%g in ('git rev-parse --git-dir 2^>nul') do set "GITDIR=%%g"
if /i "%GITDIR%"==".git" goto depot_ok

rem  Un depot trouve plus haut dans l'arborescence n'est pas le notre :
rem  envoyer depuis ici expedierait tout le dossier parent sur GitHub.
if defined GITDIR (
  echo.
  echo ===============================================
  echo   UN AUTRE DEPOT GIT ENGLOBE CE DOSSIER
  echo ===============================================
  echo   Depot trouve :
  echo     %GITDIR%
  echo   Envoyer depuis ici expedierait bien plus que Konekte.
  echo   Deplacez le dossier konekte ailleurs, par exemple
  echo   C:\konekte, puis relancez ce fichier.
  echo.
  pause
  exit /b
)

if exist ".git" (
  echo       le dossier .git est present mais illisible.
  echo       Cause la plus frequente : la synchronisation OneDrive.
  echo       Remise a neuf du depot local...
  rmdir /s /q ".git" 2>nul
)
git init -q
if errorlevel 1 (
  echo.
  echo ===============================================
  echo   LE DEPOT LOCAL N'A PAS PU ETRE CREE
  echo ===============================================
  echo   Mettez le dossier konekte en pause dans OneDrive,
  echo   ou deplacez-le hors de OneDrive ^(par exemple
  echo   C:\konekte^), puis relancez ce fichier.
  echo.
  pause
  exit /b
)
echo       depot cree.
goto depot_suite

:depot_ok
echo       depot deja present.

:depot_suite

echo.
echo [2/6] Identite Git...
rem --global : l'identite vaut pour tous vos dossiers, y compris les prochains.
rem Elle doit etre posee APRES git init, sinon elle n'a nulle part ou s'ecrire.
git config --global user.name "Michael Jacques"
git config --global user.email "anelpresident9@gmail.com"
for /f "tokens=*" %%n in ('git config user.name') do echo       nom     : %%n
for /f "tokens=*" %%m in ('git config user.email') do echo       adresse : %%m

echo.
echo [3/6] Selection des fichiers...
echo data/> .gitignore
git add -A
if errorlevel 1 (
  echo.
  echo ===============================================
  echo   LES FICHIERS N'ONT PAS PU ETRE SELECTIONNES
  echo ===============================================
  echo   Lisez le message ci-dessus et envoyez-le-moi
  echo   en photo : il dit precisement ce qui bloque.
  echo.
  pause
  exit /b
)

echo.
echo [4/6] Enregistrement...
git commit -m "Konekte v109"
if errorlevel 1 (
  rem Un depot deja a jour renvoie aussi une erreur : on verifie s'il existe
  rem au moins un enregistrement avant de renoncer.
  git rev-parse HEAD >nul 2>&1
  if errorlevel 1 (
    echo.
    echo ===============================================
    echo   AUCUN ENREGISTREMENT N'A PU ETRE FAIT
    echo ===============================================
    echo   Lisez le message ci-dessus et envoyez-le-moi
    echo   en photo : il dit precisement ce qui bloque.
    echo.
    pause
    exit /b
  )
  echo       rien de nouveau : le dernier enregistrement sera renvoye.
)

echo.
echo [5/6] Adresse GitHub...
git branch -M main
git remote remove origin 2>nul
git remote add origin https://github.com/Michaeljacques-ht/Konekte.git

echo.
echo ===============================================
echo   VERIFICATION AVANT ENVOI
echo ===============================================
echo   Dossier de depart :
echo     %CD%
echo.
echo   Depot de destination :
for /f "tokens=*" %%u in ('git remote get-url origin') do echo     %%u
echo.
echo   Le contenu du depot sera REMPLACE par celui de ce dossier.
echo.
set /p REPONSE=  Tapez la lettre O pour continuer, autre chose pour annuler :
if /i not "%REPONSE%"=="O" (
  echo.
  echo   Envoi annule. Rien n'a ete modifie sur GitHub.
  echo.
  pause
  exit /b
)

echo.
echo [6/6] Envoi vers GitHub...
echo       Une fenetre de connexion GitHub peut s'ouvrir.
echo.
git push --force -u origin main
set RESULTAT=%errorlevel%

echo.
if %RESULTAT% NEQ 0 (
  echo ===============================================
  echo   L'ENVOI A ECHOUE
  echo ===============================================
  echo   Photographiez tout l'ecran et envoyez-le-moi.
) else (
  echo ===============================================
  echo   ENVOI REUSSI
  echo ===============================================
  echo   Render redeploie tout seul en 1 a 2 minutes.
  echo   Verifiez ensuite https://bizniskonekte.tech/sw.js
  echo   La 2e ligne doit afficher : konekte-v109
)
echo.
pause
