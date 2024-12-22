const express = require('express');
var CASAuthentication = require('cas-authentication');

const dotenv = require('dotenv');
dotenv.config();
const body_parser = require('body-parser');
const session = require('express-session');

const api = require('./api');
const db = require('./scripts/database');

const fs = require('fs');

const app = express();
const route = '/internal';

app.set('view engine', 'ejs');

/**
 * CAS Authentication Setup
 * From Michigan Technological University
 * 
 * Allowed members are defined in the database
 */

const cas = new CASAuthentication({
    cas_url         : 'https://sso.mtu.edu/cas',
    service_url     : 'https://usg.mtu.edu/internal/account',
    cas_version     : '3.0',
    renew           : false,
    is_dev_mode     : true,
    dev_mode_user   : 'djreeves',
    dev_mode_info   : {
        displayName: "David Reeves",
        givenName: "David",
        sn: "Reeves",
        mail: "djreeves@mtu.edu",
        UID: "djreeves",
        memberOf: ["itss-ops-linux"],
        access: 1,
        title: "Student IT Computer Technician",
        private: true
    },
    session_name    : 'user',
    session_info    : 'user_info',
    destroy_session : false
});



// add public folder
app.use(route, express.static(__dirname + '/public'));
app.use(body_parser.json());

// add session
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
    cookie: {secure: false}
}));

// use api routes
app.use(`${route}/api`, api);

app.get(`/nav_data.json`, (req, res) => {
    // return usg.mtu.edu/nav_data.json

    let data = fs.readFileSync(__dirname + '/nav_data.json');

    res.send(data);
});

app.get(`${route}/`, (req, res) => {
    res.render(__dirname + '/views/index', {
        session: req.session
    });
});

app.get(`${route}/access`, async (req, res) => {

    let members = await db.getEndpoints.members();

    console.log(members);

    res.render(__dirname + '/views/members', {
        session: req.session,
        members: members
    });
});

app.get(`${route}/navigation`, async (req, res) => {



    res.render(__dirname + '/views/navigation', {
        session: req.session
    });
});

app.get(`${route}/nav_data.json`, (req, res) => {
    // return usg.mtu.edu/nav_data.json

    let data = fs.readFileSync(__dirname + '/nav_data.json');

    res.send(data);
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');

    db.connect();

});