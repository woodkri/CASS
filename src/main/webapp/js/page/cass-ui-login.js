//**************************************************************************************************
// CASS UI Login Page Functions
//**************************************************************************************************

//**************************************************************************************************
// Constants

const CASSUI_LOGIN_SRV = "#cassUiLoginServer";
const CASSUI_LOGIN_UN = "#cassUiLoginUsername";
const CASSUI_LOGIN_PW = "#cassUiLoginPassword";
const CASSUI_LOGIN_BTN = "#cassUiLoginBtn";
const CASSUI_LOGIN_BUSY_CTR = "#cassUiLoginBusyCtr";
const CASSUI_LOGIN_ERR_CTR = "#cassUiLoginErrorCtr";
const CASSUI_LOGIN_ERR_TXT = "#cassUiLoginErrorText";

const CASSUI_AFTER_LOGIN_PAGE = "cass-ui-home.html";

//**************************************************************************************************
// Variables

var inputUn;
var inputPw;
var ecIdentMgr;

//**************************************************************************************************
// Identity Intialization
//**************************************************************************************************

function handleFetchIdentitySuccess(obj) {
    if (EcIdentityManager.ids.length == 0) {
        debugMessage("Creating Identity.");
        var ident = new EcIdentity();
        ident.displayName = "You";
        ident.ppk = EcPpk.generateKey();
        EcIdentityManager.addIdentity(ident);
        debugMessage("Created Identity.");
        ecIdentMgr.commit(handleFetchIdentitySuccess2, handleFetchIdentityFailure);
    }
    else
        handleFetchIdentitySuccess2(obj);
}

function handleFetchIdentitySuccess2(obj) {
    debugMessage("handleFetchIdentitySuccess: ");
    loggedInIdentityName = EcIdentityManager.ids[0].displayName.trim();
    debugMessage("Display Name: " + loggedInIdentityName);
    var loggedInPkPem = EcIdentityManager.ids[0].ppk.toPk().toPem();
    debugMessage("Public Key: " + loggedInPkPem);
    loggedInPpkPem = EcIdentityManager.ids[0].ppk.toPem();
    sessionStorage.setItem("usernameWithSalt",ecIdentMgr.usernameWithSalt);
    sessionStorage.setItem("passwordWithSalt",ecIdentMgr.passwordWithSalt);
    sessionStorage.setItem("secretWithSalt",ecIdentMgr.secretWithSalt);
    sessionStorage.setItem("pad",ecIdentMgr.pad);
    sessionStorage.setItem("token",ecIdentMgr.token);
    hideLoginBusy();
    hideLoginErrorMessage();
    enableAllLoginInputs();
    clearLoginInputs();
    doAfterLoginSuccess();
}

function handleFetchIdentityFailure(failMsg) {
    debugMessage("handleFetchIdentityFailure: " + failMsg);
    if (failMsg.trim() == "User does not exist.") {
        ecIdentMgr.create(handleConfigureFromServerSuccess, handleFetchIdentityFailure);
    }
    else {
        showLoginErrorMessage("Identity fetch failed: " + failMsg);
    }
}

function handleConfigureFromServerSuccess(obj) {
    debugMessage("handleConfigureFromServerSuccess: ");
    debugMessage(obj);
    ecIdentMgr.startLogin(inputUn, inputPw); //Creates the hashes for storage and retrieval of keys.
    ecIdentMgr.fetch(handleFetchIdentitySuccess, handleFetchIdentityFailure); //This retrieves the identities and encryption keys from the server.
}

function handleConfigureFromServerFail(failMsg) {
    debugMessage("handleConfigureFromServerFail: " + failMsg);
    showLoginErrorMessage("Could not retrieve configuration from selected server: " + failMsg);
}

function initIdentity() {
    initRepo();
    ecIdentMgr = new EcRemoteIdentityManager();
    ecIdentMgr.server = selectedServer; //Sets the identity server endpoint
    ecIdentMgr.configureFromServer(handleConfigureFromServerSuccess, handleConfigureFromServerFail); //This retrieves username and password salts from the serve
}

//**************************************************************************************************
// Page Functions
//**************************************************************************************************
function doAfterLoginSuccess() {
    saveCassUiSessionState();
    location.replace(CASSUI_AFTER_LOGIN_PAGE);
}

function checkForLoginInputEnter(event) {
    if (event.which == 13 || event.keyCode == 13) {
        attemptCassUiLogin();
    }
}

function disableAllLoginInputs() {
    $(CASSUI_LOGIN_BTN).attr("disabled", "true");
    $(CASSUI_LOGIN_SRV).attr("disabled", "true");
    $(CASSUI_LOGIN_UN).attr("readonly", "true");
    $(CASSUI_LOGIN_PW).attr("readonly", "true");
}

function enableAllLoginInputs() {
    $(CASSUI_LOGIN_BTN).removeAttr("disabled");
    $(CASSUI_LOGIN_SRV).removeAttr("disabled");
    $(CASSUI_LOGIN_UN).removeAttr("readonly");
    $(CASSUI_LOGIN_PW).removeAttr("readonly");
}

function clearLoginInputs() {
    $(CASSUI_LOGIN_UN).val("");
    $(CASSUI_LOGIN_PW).val("");
}

function hideLoginBusy() {
    $(CASSUI_LOGIN_BUSY_CTR).hide();
}

function showLoginBusy() {
    $(CASSUI_LOGIN_BUSY_CTR).show();
}

function hideLoginErrorMessage() {
    $(CASSUI_LOGIN_ERR_CTR).hide();
}

function showLoginErrorMessage(errMsg) {
    hideLoginBusy();
    $(CASSUI_LOGIN_ERR_TXT).html(errMsg);
    $(CASSUI_LOGIN_ERR_CTR).show();
    enableAllLoginInputs();
}

function areLoginParamsValid() {
    var srv = $(CASSUI_LOGIN_SRV).val();
    var un = $(CASSUI_LOGIN_UN).val().trim();
    var pw = $(CASSUI_LOGIN_PW).val().trim();
    if (!srv || srv == null || !un || un == null || un.length == 0 || !pw || pw == null || pw.length == 0) {
        showLoginErrorMessage("Username, password, and server are all required");
        return false;
    }
    return true;
}

function attemptCassUiLogin() {
    repo = null;
    ecIdentMgr = null;
    EcIdentityManager.clearContacts();
    EcIdentityManager.clearIdentities();
    hideLoginErrorMessage();
    if (areLoginParamsValid()) {
        disableAllLoginInputs();
        showLoginBusy();
        selectedServer = $(CASSUI_LOGIN_SRV).val();
        inputUn = $(CASSUI_LOGIN_UN).val().trim();
        inputPw = $(CASSUI_LOGIN_PW).val().trim();
        $(CASSUI_LOGIN_PW).val("");
        initRepo();
        initIdentity();
    }
}

function checkForSessionExpiredWarning() {
    var qsp = new URLSearchParams(window.location.search);
    if (qsp.has(CASSUI_SES_EXP_QSP)) {
        clearLoginInputs();
    }
}

function init() {
    checkForSessionExpiredWarning();
}

//**************************************************************************************************
// Document on ready
//**************************************************************************************************

$(document).ready(function () {

if (typeof Keycloak !== 'undefined' && Keycloak) {
    var keycloak = Keycloak({
      "realm": "master",
      "url": window.location.origin+"/auth",
      "clientId": "cass"
    });
    var userCredentials = null;
    keycloak.init({
        onLoad: 'login-required',
        flow: 'implicit'
    }).success(function (authenticated) {
        userCredentials = authenticated;
        keycloak.loadUserProfile().then(
            function(profile){
                $("#cassUiLoginUsername").val(keycloak.subject);
                if (profile.attributes.cass_secret != null)
                {
                    $("#cassUiLoginPassword").val(profile.attributes.cass_secret[0]);
                    init();
                    $(".credentials").hide();
                    attemptCassUiLogin();
                }
                else
                    init();
            }
        ,console.error);
        init();
    }).error(function (error) {
        alert('Failed to initialize authentication');
        console.log("Keycloak sign-in error");
        console.log(error);
    });
}
else init();

});
