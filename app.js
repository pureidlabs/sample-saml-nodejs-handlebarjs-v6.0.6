var saml2 = require('saml2-js');
var fs = require('fs');
const bodyParser = require('body-parser');


const express = require('express');
const exphbs = require('express-handlebars');
var session = require('express-session');




const app = express();

app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(session({ secret: "secret" }));


app.engine('hbs', exphbs.engine({
    defaultLayout: 'main',
    extname: '.hbs'
}));

app.set('view engine', 'hbs');


// SAML
// Create service provider
var sp_options = {
    entity_id: "http://localhost:3000/auth/login",
    assert_endpoint: "http://localhost:3000/auth/acs",
    certificate: "",
    sign_get_request: false,
    allow_unencrypted_assertion: true
};
var sp = new saml2.ServiceProvider(sp_options);

// Create identity provider
var idp_options = {
    sso_login_url: "https://dev.pureauth.tech/auth/custom-app-saml/e2b1c38962/e9f7b53b-7619-49bf-80b1-61b6a43d7594",
    sso_logout_url: "https://dev.pureauth.tech/auth/custom-app-saml/e2b1c38962/e9f7b53b-7619-49bf-80b1-61b6a43d7594/logout",
    certificates: [fs.readFileSync("x509.pem").toString()]
};
var idp = new saml2.IdentityProvider(idp_options);

app.get('/', (req, res) => {

    res.render('home', {
        authUser: req.session.auth_user
    });
});

// ------ Define express endpoints ------

// Endpoint to retrieve metadata
app.get("/metadata.xml", function (req, res) {
    res.type('application/xml');
    res.send(sp.create_metadata());
});

app.get('/auth/login', (req, res) => {
    sp.create_login_request_url(idp, {}, function (err, login_url, request_id) {
        if (err != null)
            return res.send(500);
        res.redirect(login_url);
    });
});

// Variables used in login/logout process
var name_id, session_index;

// Assert endpoint for when login completes
app.post("/auth/acs", function (req, res) {
    var options = { request_body: req.body };
    // res.send(options);
    sp.post_assert(idp, options, function (err, saml_response) {
        if (err != null) {
            console.log(err);
            return res.status(500).send(arguments);
        }

        // Save name_id and session_index for logout
        // Note:  In practice these should be saved in the user session, not globally.
        name_id = saml_response.user.name_id;
        session_index = saml_response.user.session_index;

        // res.send("Hello #{name_id}! session_index: #{session_index}.");
        req.session.auth_user = name_id;
        res.redirect('/');
    });
});

// Starting point for logout
app.get("/auth/logout", function (req, res) {
    var options = {
        name_id: name_id,
        session_index: session_index
    };

    sp.create_logout_request_url(idp, options, function (err, logout_url) {
        if (err != null)
            return res.sendStatus(500);

        delete req.session.auth_user;
        res.redirect(logout_url);
    });
});

app.listen(3000, () => {
    console.log('The web server has started on port 3000');
});