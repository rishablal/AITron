# AITron

## Overview

AITron is an online multiplayer game that is essentially my version of the classic game Tron. Players can either join or host games, between 2-4 players a game, in a real-time, interactive lobby setting. In a game, players will move in any direction, dropping a trail behind them as they go. Players must avoid each other's trails, as well as the borders of the game window, or else they lose. The last player standing wins! Players can view their own win-loss statistics as well as global rankings of every player in the lobby.

## Motivation

This is my first full stack web development project, and so this application showcases my coding ability in several web technologies.

## Development Stack

Front End:
* AJAX
* jsDOM
* HTML5 Canvas
* CSS

Back End:
* Node.JS
* Express.JS
* Socket.IO
* Mongo DB

## Notes

1. Application is deployed [here](https://aitron.herokuapp.com/)
2. Local setup is slightly broken because the application requires a Mongo DB connection
3. Application is currently experiencing syncronization issues, probably due to implementation choice (this application is mostly to showcase my code, logic, and use of web technologies)