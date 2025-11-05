const express = require('express');
var CASAuthentication = require('cas-authentication');

var url           = require('url'),
    http          = require('http'),
    https         = require('https'),
    parseXML      = require('xml2js').parseString,
    XMLprocessors = require('xml2js/lib/processors');

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

/**
 * Redirects the client to the CAS login.
 */
CASAuthentication.prototype._login = function(req, res, next) {

    // Save the return URL in the session. If an explicit return URL is set as a
    // query parameter, use that. Otherwise, just use the URL from the request.
    req.session.cas_return_to = req.query.returnTo || url.parse(req.url).path;

    // Set up the query parameters.
    var query = {
        service: this.service_url + url.parse(req.url).pathname
    };

    // Redirect to the CAS login.
    res.redirect( this.cas_url + url.format({
        pathname: '/login',
        query: query
    }));
};

const cas = new CASAuthentication({
    cas_url         : 'https://sso.mtu.edu/cas',
    service_url     : 'https://usg.mtu.edu',
    cas_version     : '3.0',
    is_dev_mode     : true,
    dev_mode_user   : 'usg',
    dev_mode_info   : {
        displayName: "David Reeves",
        givenName: "David",
        sn: "Reeves",
        mail: "djreeves@mtu.edu",
        UID: "usg",
        memberOf: ["itss-ops-linux"],
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

async function getAccessFromDb(username) {
    let permanent_accounts_string = await db.getEndpoints.config('permanent_accounts');
    let permanent_accounts = [];
    if(permanent_accounts_string != null && permanent_accounts_string.value){
        permanent_accounts = permanent_accounts_string.value.split(',');
    }

    let memberObj = null;
    if(permanent_accounts.includes(username)){
        // this user is a permanent admin
        memberObj = {
            username: username,
            access: 'admin',
        };
    }else{
        memberObj = await db.getEndpoints.member(username);
    }

    if(!memberObj){
        console.log("User not found in database, treat as guest");
        memberObj = {
            username: username,
            access: 'guest'
        };
    }

    return memberObj.access;
}

// Middleware to refresh session access
// read from the database each time
function refreshSession(req, res, next) {
    // refresh the session access
    let username = req.session.user;
    if(username != null && username != undefined && username != ''){
        getAccessFromDb(username).then(access => {
            req.session.user_info.access = access;
            next();
        });
    }
    else {
        // no user, just continue
        next();
    }
}

// expecting can be 'admin', 'member', 'logged_out' or 'any'
function checkAuthentication(sessionInfo, expecting) {
    if (!sessionInfo || !sessionInfo.access) {
        return expecting === 'logged_out';
    }

    switch (expecting) {
        case 'admin':
            return sessionInfo.access === 'admin';
        case 'member':
            return sessionInfo.access === 'member' || sessionInfo.access === 'admin';
        case 'any':
            return true;
        default:
            return false;
    }
}

app.get(`${route}/session`, refreshSession, (req, res) => {
    // return an object with the session data
    let obj = {
        user: req.session.user,
        user_info: req.session.user_info
    };

    res.json(obj);
});

app.get(`${route}/authenticate`, refreshSession, cas.bounce, async (req, res) => {

    let username = req.session.user;
    console.log("Authenticated user:", username);

    // let permanent_accounts_string = await db.getEndpoints.config('permanent_accounts');
    // let permanent_accounts = [];
    // if(permanent_accounts_string != null && permanent_accounts_string.value){
    //     permanent_accounts = permanent_accounts_string.value.split(',');
    // }

    // let memberObj = null;
    // if(permanent_accounts.includes(username)){
    //     // this user is a permanent admin
    //     memberObj = {
    //         username: username,
    //         access: 'admin',
    //     };
    // }else{
    //     memberObj = await db.getEndpoints.member(username);
    // }

    // if(!memberObj){
    //     console.log("User not found in database, treat as guest");
    //     memberObj = {
    //         username: username,
    //         access: 'guest'
    //     };
    // }
    let access = await getAccessFromDb(username);

    let user_info = req.session.user_info;
    req.session.user_info = {
        access: access,
        ...user_info
    };

    // usg user is automatically an admin

    res.redirect('/');
});

app.get(`${route}/logout`, cas.logout, (req, res) => {
    res.redirect('/internal');
});

app.get(`/test`, (req, res) => {
    res.sendFile(__dirname + '/testing/member-profile.html');
});

app.get(`/nav_data.json`, refreshSession, (req, res) => {
    // return usg.mtu.edu/nav_data.json

    let data = fs.readFileSync(__dirname + '/nav_data.json');

    res.send(data);
});

app.get("/", (req, res) => {
    // redirect to /{route}
    res.redirect(`/${route}`);
})

// get any file
// specified by the path /uploaded/*
app.get(`${route}/uploaded/*`, refreshSession, (req, res) => {

    let useFileName = req.path.split('/').pop();

    let filePath = __dirname + "/uploaded/" + useFileName;

    console.log("Requested file:", filePath);

    // check if the file exists
    if(fs.existsSync(filePath)){
        res.sendFile(filePath);
    } else {
        res.status(404).send('File not found');
    }
});

app.get(`${route}/`, refreshSession, (req, res) => {

    console.log("SESSION", req.session);

    res.render(__dirname + '/views/index', {
        session: req.session
    });
});

app.get(`${route}/access`, refreshSession, async (req, res) => {

    let members = await db.getEndpoints.members();

    console.log(members);
    let permanent_accounts_string = await db.getEndpoints.config('permanent_accounts');
    let permanent_accounts = [];
    if(permanent_accounts_string != null && permanent_accounts_string.value){
        console.log("Permanent accounts string:", permanent_accounts_string.value);
        permanent_accounts = permanent_accounts_string.value.split(',');
    }

    res.render(__dirname + '/views/members', {
        session: req.session,
        members: members,
        permanent_accounts: permanent_accounts
    });
});

app.get(`${route}/navigation`, refreshSession, async (req, res) => {



    res.render(__dirname + '/views/navigation', {
        session: req.session
    });
});

app.get(`${route}/profile`, refreshSession, async (req, res) => {

    let user = req.session.user;
    if(req.query.profile){
        user = req.query.profile;
    }

    if(!user || user == ''){
        res.status(400).send('No user specified');
        return;
    }

    let profile = await db.getEndpoints.profile(user, true);
    if(profile.length == 0){
        // then check the non-draft profiles
        profile = await db.getEndpoints.profile(user, false);
        if(profile.length == 0){
            res.status(404).send('Profile not found');
            return;
        }

        await db.postEndpoints.profile(
            profile.username,
            profile.name,
            profile.position,
            profile.status,
            profile.data,
            true
        );  
        
    }

    profile = profile[0];

    res.render(__dirname + '/views/profile', {
        session: req.session,
        profile: profile
    });
});

app.get(`${route}/profiles`, refreshSession, async (req, res) => {
    
    let profiles = await db.getEndpoints.profiles([], false);

    let members = await db.getEndpoints.members();
    // get the member names...
    let memberUsernames = members.map(m => {
        return m.username;
    })

    // find the members that are not in the profiles
    let membersWithoutProfiles = memberUsernames.filter(m => {
        return !profiles.some(p => p.username === m);
    });

    console.log("Members:", members, "Profiles:", profiles, "Members without profiles:", membersWithoutProfiles);

    res.render(__dirname + '/views/profiles', {
        session: req.session,
        profiles: profiles,
        members: memberUsernames,
        membersWithoutProfiles: membersWithoutProfiles
    });
});

app.get(`${route}/elections`, refreshSession, async (req, res) => {
    
    // let profiles = await db.getEndpoints.profiles([], false);

    // let members = await db.getEndpoints.members();
    // // get the member names...
    // let memberUsernames = members.map(m => {
    //     return m.username;
    // })

    // // find the members that are not in the profiles
    // let membersWithoutProfiles = memberUsernames.filter(m => {
    //     return !profiles.some(p => p.username === m);
    // });

    // console.log("Members:", members, "Profiles:", profiles, "Members without profiles:", membersWithoutProfiles);

    res.render(__dirname + '/views/elections', {
        session: req.session
    });
});

app.get(`${route}/break-bus`, refreshSession, async (req, res) => {

    try{
        // get the user access
        let access = req.session.user_info.access;
        if(access != 'admin' && access != 'member'){
            res.status(403).send('Forbidden: You do not have access to this page.');
            return;
        }
    }catch(err){
        res.status(403).send('Forbidden: You do not have access to this page.');
        return;
    }

    // need to get the home-banner.json
    let data = fs.readFileSync(__dirname + '/testing/break-bus-info.json');
    data = JSON.parse(data);

    res.render(__dirname + '/views/breakbus.ejs', {
        session: req.session,
        data: data    
    });
});

app.get(`${route}/template/:template*`, refreshSession, async (req, res) => {

    // also add the query parameters as variables to the template
    let query = req.query;
    let useData = {
        session: req.session
    };
    for(let key in query){
        useData[key] = query[key];
    }

    let template = req.params.template;

    console.log("Requested template:", template, "with query:", query);

    var data;

    let background_color;
    let bennerColor;
    let currentDate;
    let runStart;
    let runEnd;

    switch(template){
        case 'member_profile.ejs':
            // add all of the profile details to the template data
            let profiles = await db.getEndpoints.profiles([query.position]);
            // TODO: figure out something better than this
            if(profiles.length == 0){
                useData.profiles = [];
                break;
            }

            
            useData.profiles = [];

            // also parse on username and status if provided



            for(let i = 0; i < profiles.length; i++){
                let profile = profiles[i];
                let profileData = JSON.parse(profile.data);

                let username = profile.username || "";
                let status = profile.status || "hide";

                // if username contains "$final", then keep it as is
                if(username.includes("$final")){
                    username = username.replace("$final", "");
                }else{
                    continue;
                }

                // if status is not "ok", then skip this profile
                if(status != "ok"){
                    continue;
                }

                if(!profileData){
                    profileData = {};
                }
                if(i % 2 == 0){
                    profileData.alternate = true;
                }
                useData.profiles.push({
                    ...profile,
                    ...profileData
                });
            }
            break;
        case "nav_bar.ejs":
            // need to get links from the nav_data.json file
            // generate into columns for the nav bar (done in ejs)

            data = fs.readFileSync(__dirname + '/nav_data.json');
            let navData = JSON.parse(data);
            // data["categories"] has { link, name }
            // category["links"] has { link, name, special }


            useData.categories = navData["categories"] || [];
            break;
        case "home_banner.ejs":
            // need to get links from the nav_data.json file
            // generate into columns for the nav bar (done in ejs)

            data = fs.readFileSync(__dirname + '/testing/home-banner.json');
            data = JSON.parse(data);
            backgroundColor = data["background_color"] || "var(--usg-secondary)";
            bannerColor = data["color"] || "var(--usg-primary)";
            // data["categories"] has { link, name }
            // category["links"] has { link, name, special }


            useData.banner_background = backgroundColor;
            useData.banner_color = bannerColor;
            useData = {
                ...useData,
                banner: data
            };

            // check the run_start and run_end dates as well
            // if the current date is between those dates, then show the banner
            currentDate = new Date();
            runStart = new Date(data["run_start"]);
            runEnd = new Date(data["run_end"]);

            if(currentDate < runStart || currentDate > runEnd){
                res.send("");
                // return absolutely nothing
                return;
            }

            console.log("Using banner data:", useData);
            break;
        case "breakbus_banner.ejs":
            // need to get links from the nav_data.json file
            // generate into columns for the nav bar (done in ejs)

            data = fs.readFileSync(__dirname + '/testing/break-bus-info.json');
            data = JSON.parse(data);
            backgroundColor = data["background_color"] || "var(--usg-secondary)";
            bannerColor = data["color"] || "var(--usg-primary)";
            // data["categories"] has { link, name }
            // category["links"] has { link, name, special }


            useData.banner_background = backgroundColor;
            useData.banner_color = bannerColor;
            useData = {
                ...useData,
                banner: data
            };

            // check the run_start and run_end dates as well
            // if the current date is between those dates, then show the banner
            currentDate = new Date();
            runStart = new Date(data["run_start"]);
            runEnd = new Date(data["run_end"]);

            if(currentDate < runStart || currentDate > runEnd || useData.banner.hidden){
                res.send("");
                // return absolutely nothing
                return;
            }

            console.log("Using banner data:", useData);
            break;
        case "office_hours.ejs":
            // need to get all of the blocks from the office-blocks.json file
            data = fs.readFileSync(__dirname + '/testing/office-blocks.json');
            data = JSON.parse(data);

            let labels = [
                "Sunday",
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday"
            ];

            // we will have 14 days
            // each are separate objects
            // each day will have the blocks that are on that day
            // along with the day of the week label
            let days = {
                0: {},
                1: {},
                2: {},
                3: {},
                4: {},
                5: {},
                6: {},
                7: {},
                8: {},
                9: {},
                10: {},
                11: {},
                12: {},
                13: {}
            };
            // start at the first block day, each block we get the delta day from the start day
            // and then use that to determine the index

            let startDate = new Date(data.start);
            // just get day of week and start looping through...
            for(let i = 0; i < 14; i++){
                let currentDate = new Date(startDate);
                currentDate.setDate(startDate.getDate() + i);
                let dayOfWeek = currentDate.getDay();
                days[i] = {
                    label: labels[dayOfWeek],
                    date: currentDate.toISOString().split('T')[0], // YYYY-MM-DD
                    blocks: []
                };
            }

            // loop through each block and begin sorting (based on the delta from startDate)

            // foreach block, get the hours and turn into class name
            data.blocks = data.blocks.map(block => {
                let className = "";
                let hoursString = block.hours;

                // replace . with -
                hoursString = hoursString.toString().replace('.', '-');

                className = "time" + hoursString;

                return {...block, className: className};
            });

            for(let block of data.blocks){
                let blockDate = new Date(block.block_start);
                let deltaDays = Math.floor((blockDate - startDate) / (1000 * 60 * 60 * 24));
                if(deltaDays >= 0 && deltaDays < 14){
                    days[deltaDays].blocks.push(block);
                }
            }

            // delete Saturday / Sunday keys
            for(let i = 0; i < 14; i++){
                if(days[i].label == "Saturday" || days[i].label == "Sunday"){
                    delete days[i];
                }
            }

            let arrayOfDays = [];

            // go through the days object and put into an array
            // in order from 0 to 13
            for(let i = 0; i < 14; i++){
                if(days[i]){
                    arrayOfDays.push(days[i]);
                }
            }

            // put into blocks object
            useData.days = arrayOfDays;
            break;
            
    }

    console.log("Rendering template:", template, "with data:", useData);

    
    res.render(__dirname + `/views/templates/${template}`, useData);
});

app.get(`${route}/post-view`, refreshSession, async (req, res) => {
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

app.get(`${route}/nav_data.json`, refreshSession, (req, res) => {
    // return usg.mtu.edu/nav_data.json

    let data = fs.readFileSync(__dirname + '/nav_data.json');

    res.send(data);
});

app.get(`${route}/break-bus-info.json`, refreshSession, (req, res) => {
    // return usg.mtu.edu/nav_data.json

    let data = fs.readFileSync(__dirname + '/testing/break-bus-info.json');

    res.send(data);
});

/**
 * Endpoints for the tablets...
 * 
 * /internal/today_office_hours.csv
 */
app.get(`${route}/today_office_hours.csv`, (req, res) => {
    // read in the office-blocks.json file
    let data = fs.readFileSync(__dirname + '/testing/office-blocks.json');
    data = JSON.parse(data);

    let blocks = data.blocks;

    let today = new Date();
    let todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // filter blocks for today
    let todaysBlocks = blocks.filter(block => {
        let blockDate = new Date(block.block_start);
        let blockDateString = blockDate.toISOString().split('T')[0];
        return blockDateString == todayString;
    });

    // now get the people in each block
    let useBlocks = [];
    for(let block of todaysBlocks){
        // get subblocks for this block
        let subblocks = block.sub_blocks;
        for(let subblock of subblocks){

            let startTime = new Date(subblock.start);
            let endTime = new Date(subblock.end);

            // format timeA or timeB in 12:00 AM/PM format
            useBlocks.push({
                block_start: subblock.start,
                block_end: subblock.end,
                email: subblock.email,
                approved: "Yes",
                name: subblock.name,
                hours: subblock.hours,
                timeA: startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                timeB: endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            });
        }
    }
    
    // now convert to CSV
    let csv = "Date Start,Date End,Email,Approved,Name,TimeA,TimeB\n";
    for(let block of useBlocks){
        csv += `${block.block_start},${block.block_end},${block.email},${block.approved},${block.name},${block.timeA},${block.timeB}\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.send(csv);
});

app.post(`${route}/office_blocks`, refreshSession, (req, res) => {
    // just come up with general API key and compare
    let key = req.body.key;
    let blocks = req.body.blocks;
    let start = req.body.start;

    // check the key with the env.GENERAL_KEY

    if(!(key && key == process.env.GENERAL_KEY)){
        res.status(401).send("Unauthorized");
    }

    let jsonObj = {
        start: start,
        blocks: blocks
    };

    // now write to the file
    fs.writeFileSync(__dirname + '/testing/office-blocks.json', JSON.stringify(jsonObj, null, 4));

    res.json({status: "ok"});
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');

    db.initializeTables();

    // manual test code to add a default configuration for current_elections
    // read in from the testing/election-data.json file
    let electionData = fs.readFileSync(__dirname + '/testing/election-data.json');
    db.postEndpoints.config(
        "current_elections",
        "Current Elections",
        "The current elections that are being held",
        electionData.toString() // convert to string for storage
    );

    // manual test code to add a default configuration for home_banner
    db.postEndpoints.config(
        "home_banner",
        "Home Banner",
        "The banner displayed on the home page",
        fs.readFileSync(__dirname + '/testing/home-banner.json').toString()
    );

});

