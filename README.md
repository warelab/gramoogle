# gramoogle
Gramene Search Interface
[![Build Status](https://travis-ci.org/warelab/gramoogle.svg?branch=master)](https://travis-ci.org/warelab/gramoogle)

## Install
1. `npm install`
2. `npm install -g live-server`
3. `npm install -g grunt-cli`

## View/run with live recompile/refresh
1. In one terminal window, with wd project root:

    `grunt`

   This command builds the .js and .css files. It also watches for changes and updates those files while you work.
2. In another, with wd project root:
 
    `cd build`
    `live-server`

   This runs a server that watches the files generated by grunt and injects a doodad into the page to cause a refresh whenever the files change
   
3. In your browser, go to [127.0.0.1:8080](http://127.0.0.1:8080)

## Development Policies
Please read [this document on working with this repository](DEVELOPMENT.md)
