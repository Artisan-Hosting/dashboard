A few more things I want to implement: 

the apps page where we show the boxes with each repo, we should bring back controls there so we could start, stop and restart at the progect level so we don't always have to 
go control each instance, both surfaces is fine. 

The default options in the 'select enviornment' drop down should actually match the fully spelled out names, prod -> production stage -> staging and etc, bonus points, if I 
feel like implementing a system that scans the configs for the projects and dynamically computes what envionments exist for each project.

The repo page needs to dynamically backfill the repos deployed based on what the nodes report since we collect that data. Ideally the flow is more of a push only system,
but the nodes do have the tooling for me to dip in and add custom repos to all of them still, so it does need to be a push pull system for now so everyone stays in sync.

The api website + cli need to implement a button to force nodes to pull and make the latest env data from the secret server, the push and pull syncs work fine and the 
push on save work well, but an option somewhere to force nodes to actually re-sync that with the same toast pop ups when they finish as the applications states would be great

405 error on using the invite token

single user multi org 
adding existing users to orgs, search by email ideally

the details page for nodes should show what ais info does. the system lib version, the watchdog version, any security violations and general system info

a fallback filter, if we can't resolve the project id into a git name, it shouldn't be shown, the SUPER class user should have a filter button with this off by default 
but for day to day operations ticking a show all or something similar should show everything the system thinks it has

bump up the timeouts on pushing configs, like 15s would probably be fine, OR simply show a 'we pushed the changes' then listen for the response in the background and auto re
load the config 