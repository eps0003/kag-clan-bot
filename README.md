# <img src="https://github.com/eps0003/kag-clan-bot/blob/master/icon.png" width="64"> King Arthur's Gold Clan Bot

A King Arthur's Gold Discord bot for clans, clan-wars and match scheduling

## Usage
**1. Schedule:** Two clans first need to schedule a date and time for a match using the `schedule` command  
**2. Play:** When the scheduled time arrives, the clans play their match  
**3. Report:** Once the match is over, either clan can report the score of the match using the `report` command  
**4. Confirm:** The opposing clan must confirm the results of the match using the `confirm` command for it to be finalised

## Commands
Commands can be found by typing the `help` command

## Setup
#### Node.js packages
Install the required Node.js packages by typing `npm install`
#### MySQL tables
Create the following tables in your database
```sql
CREATE TABLE 'clans' (
  'clanname' tinytext,
  'leaderid' tinytext,
  'wins' smallint(5) unsigned DEFAULT '0',
  'losses' smallint(5) unsigned DEFAULT '0',
  'draws' smallint(5) unsigned DEFAULT '0',
  'elo' double(6,2) DEFAULT '1000.00',
  'datetime' datetime DEFAULT CURRENT_TIMESTAMP,
  'region' tinytext
)
```
```sql
CREATE TABLE 'clanwars' (
  'winclan' tinytext,
  'loseclan' tinytext,
  'winscore' tinyint(3) unsigned DEFAULT NULL,
  'losescore' tinyint(3) unsigned DEFAULT NULL,
  'datetime' datetime DEFAULT NULL
)
```
```sql
CREATE TABLE 'pending' (
  'winclan' tinytext,
  'loseclan' tinytext,
  'winscore' tinyint(3) unsigned DEFAULT NULL,
  'losescore' tinyint(3) unsigned DEFAULT NULL,
  'datetime' datetime DEFAULT NULL,
  'pendingclan' tinytext
)
```
```sql
CREATE TABLE 'schedule' (
  'clanA' tinytext,
  'clanB' tinytext,
  'datetime' datetime DEFAULT NULL
)
```

## Authors
Made by [epsilon](https://forum.thd.vg/members/epsilon.16800/)  
Concept by [mcrifel](https://forum.thd.vg/members/mcrifel.16453/)  
Special thanks to [cameron1010](https://forum.thd.vg/members/cameron1010.6469/) and [Eluded](https://forum.thd.vg/members/eluded.8036/)
