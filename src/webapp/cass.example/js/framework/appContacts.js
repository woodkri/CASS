var commitTimeout = null;
EcIdentityManager.onContactChanged = function (contact) {
    if (commitTimeout != null)
        clearTimeout(commitTimeout);
    commitTimeout = setTimeout(function () {
        commitTimeout = null;
        if (identity == null) return;
        loginServer.commit(function () {}, silent);
        populateContacts();
    }, 5000);
}
EcIdentityManager.onIdentityChanged = function (identity) {
    if (commitTimeout != null)
        clearTimeout(commitTimeout);
    commitTimeout = setTimeout(function () {
        commitTimeout = null;
        if (identity == null) return;
        loginServer.commit(function () {}, silent);
        populateContacts();
    }, 5000);
}

var contactsContact = $(".contactsContact").outerHTML();

function populateContacts() {
    populateContactsActual();
    actionAddContactCheck();
}

function populateContactsActual() {
    $("#contactsList").html("");
    for (var i = 0; i < EcIdentityManager.ids.length; i++) {
        var identity = EcIdentityManager.ids[i];
        var ui = $("#contactsList").append(contactsContact).children().last();
        ui.find("a").hide();
        ui.find("#identity").attr("title", identity.ppk.toPk().toPem()).text("(You) " + identity.displayName);
    }
    for (var i = 0; i < EcIdentityManager.contacts.length; i++) {
        var contact = EcIdentityManager.contacts[i];

        if (EcIdentityManager.getPpk(contact.pk) == null) {
            var ui = $("#contactsList").append(contactsContact).children().last();
            ui.find("#identity").attr("title", contact.pk.toPem()).text(contact.displayName);
        }
    }
}

function updateContact(me) {
    var pk = EcPk.fromPem($(me).attr("title"));
    var displayName = $(me).text();
    var contact = null;
    var found = false;
    for (var i = 0; i < EcIdentityManager.ids.length; i++) {
        if (pk.equals(EcIdentityManager.ids[i].ppk.toPk())) {
            found = true;
            contact = EcIdentityManager.ids[i];
            contact.displayName = displayName.replace("(You) ", "");
            EcIdentityManager.identityChanged(contact);
        }
    }
    if (!found) {
        if (EcIdentityManager.getContact(pk) != null) {
            contact = EcIdentityManager.getContact(pk);
            contact.displayName = displayName;
            EcIdentityManager.contactChanged(contact);
        } else {
            contact = new EcContact();
            contact.pk = pk;
            contact.displayName = displayName;
            EcIdentityManager.addContact(contact);
        }
    }
}

function removeContact(me) {
    var pk = EcPk.fromPem($(me).parents(".contact").find("#identity").attr("title"));
    for (var i = 0; i < EcIdentityManager.contacts.length; i++) {
        if (pk.equals(EcIdentityManager.contacts[i].pk)) {
            EcIdentityManager.contacts.splice(i, 1);
            EcIdentityManager.contactChanged(EcIdentityManager.contacts[i]);
            populateContactsActual();
        }
    }
}

function getShareString() {
    var input = window.prompt("What name would you like the recipient to know you by?", identity.displayName);
    var string = "Hi, I would like to add you as a contact in CASS.\n\nIf we are using the same CASS system, you may click the following link. If not, change the URL of my CASS server (" + window.location.href.split('/')[2] + ") to yours.\n\n"

    var iv = EcAes.newIv(32);
    string += window.location + "?action=newContact&contactDisplayName=" + encodeURIComponent(input) + "&contactKey=" + encodeURIComponent(identity.ppk.toPk().toPem()) + "&contactServer=" + encodeURIComponent(repo.selectedServer) + "&responseToken=" + encodeURIComponent(iv) + "&responseSignature=" + encodeURIComponent(EcRsaOaep.sign(identity.ppk, iv));

    copyTextToClipboard(string);
    alert("The invitation has been copied to your clipboard.");
}

function actionAddContactCheck() {
    if (QueryString.action == "newContact" && identity != null) {
        var c = new EcContact();
        c.displayName = QueryString.contactDisplayName;
        c.pk = EcPk.fromPem(QueryString.contactKey);
        c.source = QueryString.contactServer;
        EcIdentityManager.addContact(c);
        if (window.confirm("Contact added. Would you like to reply with your contact info?")) {
            var grant = new EcContactGrant();
            grant.addOwner(c.pk);
            grant.addOwner(identity.ppk.toPk());
            grant.generateId(c.source);
            grant.source = loginServer.server;
            var displayName = window.prompt("How would you like to identify yourself to them?", identity.displayName);
            if (displayName != null) {
                grant.displayName = displayName;
                grant.pk = identity.ppk.toPk().toPem();
                grant.responseToken = QueryString.responseToken;
                grant.responseSignature = QueryString.responseSignature;
                grant.signWith(identity.ppk);
                var encrypted = EcEncryptedValue.toEncryptedValue(grant, false);
                EcRepository.save(encrypted, function (success) {
                    loginServer.commit(function () {
                        window.alert("Response sent. The page will now reload.");
                        window.location = window.location.href.split('?')[0];
                    }, silent);
                }, error);
            }
        }
    }

    var searchString = '(@encryptedType:"' + EcContactGrant.myType + '")';
    repo.search(searchString, function (encryptedValue) {
        EcRepository.get(encryptedValue.shortId(), function (encryptedValue) {
            var ev = new EcEncryptedValue();
            ev.copyFrom(encryptedValue);
            var grant = ev.decryptIntoObject();
            if (grant != null) {
                var g = new EcContactGrant();
                g.copyFrom(grant);
                if (g.valid())
                    if (window.confirm("Someone identifying themselves as " + g.displayName + " has accepted your request. Would you like to add them to your contact list?")) {
                        var contact = new EcContact();
                        contact.pk = EcPk.fromPem(g.pk);
                        contact.source = g.source;
                        contact.displayName = g.displayName;
                        EcIdentityManager.addContact(contact);
                        alert(contact.displayName + " has accepted your invitation to connect and has been added to your contact list.");
                        populateContactsActual();
                    };
            }
            EcRepository._delete(ev);
        }, error);
    }, null, error);

}
