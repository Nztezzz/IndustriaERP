========================================
  PREYANSH ERP - INSTALLATION GUIDE
========================================

WHAT THIS IS
------------
Preyansh ERP is a desktop application for managing stock, dispatches,
reel tracking, and packing slips. It runs entirely on your own computer.
No internet connection is required to use it, and no data ever leaves
your machine.


HOW TO INSTALL
--------------
1. Double-click "Preyansh-ERP-Setup-v0.1.0.exe"

2. If Windows shows a blue "Windows protected your PC" warning:
      - Click "More info"
      - Click "Run anyway"
   This appears because the installer is not code-signed. It is safe.

3. Follow the installer. It takes about 10 seconds and does NOT
   require administrator rights.

4. When it finishes, Preyansh ERP opens automatically.
   You can also find it later in your Start Menu under "Preyansh ERP",
   or on your Desktop.


FIRST TIME YOU OPEN IT  ** IMPORTANT **
---------------------------------------
The app creates an administrator account for you automatically and
shows the username and password in a pop-up window.

   >>> WRITE THESE DOWN BEFORE CLOSING THAT WINDOW. <<<

They are shown ONCE and cannot be recovered afterwards.

After signing in you can change both the username and the password:
   Settings  ->  Profile


WHAT YOU GET OUT OF THE BOX
---------------------------
The app comes pre-loaded with the standard product list:
   - Plastic Reel
   - 300 mm Spool
   - 500 mm Spool
   - 630 mm Spool
   - 800 mm Spool

You will need to add your own customers before recording
inward/outward entries, because those forms require a customer:
   Customers  ->  New customer


SYSTEM REQUIREMENTS
-------------------
   - Windows 10 (version 1803 or newer) or Windows 11
   - 64-bit
   - ~150 MB free disk space

Windows 10 and 11 already include the component this app needs
(Microsoft Edge WebView2). On the rare older machine that does not have
it, the installer downloads it automatically - that step alone needs a
one-time internet connection.


WHERE YOUR DATA IS STORED
-------------------------
Everything lives in a single database file on your computer:

   %APPDATA%\com.preyanshindustries.erp\preyansh-erp.db

To find it: press Windows+R, paste the line below, press Enter:

   %APPDATA%\com.preyanshindustries.erp

Your data is NOT shared with anyone and is NOT uploaded anywhere.


BACKUPS  (please do this regularly)
-----------------------------------
   Settings  ->  Backup & Restore  ->  Create backup

Backups are saved next to the database, in a "backups" folder.
Copy them to a USB drive or cloud folder for safekeeping.

You can restore any backup from the same screen. Restoring replaces
ALL current data and restarts the app, so it cannot be undone.


UNINSTALLING
------------
Windows Settings -> Apps -> "Preyansh ERP" -> Uninstall

NOTE: Uninstalling does NOT delete your data. Your database stays in
the folder above, so reinstalling later keeps all your records. To
remove the data too, delete that folder manually.


TROUBLESHOOTING
---------------
App will not start, or shows a blank white window
   Restart your computer and try again. If it persists, install the
   WebView2 Runtime manually from:
   https://developer.microsoft.com/microsoft-edge/webview2/

"Port already in use" or the app opens twice
   Preyansh ERP is already running. Check your taskbar, or open Task
   Manager, end any "Preyansh ERP" processes, then reopen it.

I forgot my password
   There is no password reset. If you still have a backup from before
   the password change, restore it. Otherwise the data folder must be
   deleted to start fresh (this erases all records) - so keep backups.

Printing shows a blank or cut-off page
   Use the Print button inside the app (not your browser's print).
   In the print dialog, set paper size to A4 and enable "Background
   graphics" if colours are missing.
