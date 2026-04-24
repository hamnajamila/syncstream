/* 
  DIAGNOSTIC BOOTSTRAP - ES3 COMPATIBLE
  This script is designed to run on ANY phone, even from 2012.
*/

// Use var only
var banner = document.getElementById('status-banner');

function updateStatus(text, color) {
    if (banner) {
        banner.style.backgroundColor = color;
        banner.innerText = text;
    }
}

// Global error handler
window.onerror = function(msg, url, lineNo) {
    updateStatus('JS ERROR: ' + msg + ' (L' + lineNo + ')', '#EF4444');
    return false;
};

updateStatus('DEBUG: ATTEMPTING REACT MOUNT...', '#3B82F6'); // Blue

try {
    // We will dynamically check for features
    if (typeof Promise === 'undefined') {
        updateStatus('FAIL: NO PROMISE SUPPORT', '#EF4444');
    } else {
        console.log("Environment check passed, looking for root");
    }
} catch(e) {
    updateStatus('FAIL: ENV CHECK CRASH', '#EF4444');
}
