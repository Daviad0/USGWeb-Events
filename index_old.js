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
    service_url     : 'https://usg.mtu.edu/internal/authenticate',
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

app.get(`${route}/authenticate`, cas.bounce, (req, res) => {
    res.redirect('/internal');
});

app.get(`${route}/logout`, cas.logout, (req, res) => {
    res.redirect('/internal');
});

app.get(`/test`, (req, res) => {
    res.sendFile(__dirname + '/testing/member-profile.html');
});

app.get(`/nav_data.json`, (req, res) => {
    // return usg.mtu.edu/nav_data.json

    let data = fs.readFileSync(__dirname + '/nav_data.json');

    res.send(data);
});

app.get(`${route}/`, (req, res) => {

    console.log("SESSION", req.session);

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

app.get(`${route}/profile`, async (req, res) => {

    let user = 'djreeves';
    if(req.query.profile){
        user = req.query.profile;
    }

    let profile = await db.getEndpoints.profile(user);
    if(profile.length == 0){
        res.status(404).send('Profile not found');
        return;
    }

    profile = profile[0];

    res.render(__dirname + '/views/profile', {
        session: req.session,
        profile: profile
    });
});

app.get(`${route}/profiles`, async (req, res) => {
    
    let profiles = await db.getEndpoints.profiles();

    res.render(__dirname + '/views/profiles', {
        session: req.session,
        profiles: profiles
    });
});

app.get(`${route}/posts`, async (req, res) => {
    
    let posts = await db.getEndpoints.posts();

    res.render(__dirname + '/views/posts', {
        session: req.session,
        posts: posts
    });
});

app.get(`${route}/post-view`, async (req, res) => {
    let id = req.query.post;

    let post = await db.getEndpoints.post(id);

    if(post.length == 0){
        res.status(404).send('Post not found');
        return;
    }

    post = post[0];

    res.render(__dirname + '/views/view_post', {
        session: req.session,
        post: post
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