'use strict';

var _ = require('lodash');
var moment = require('moment');
var fs = require('fs');

var webserviceVersion = 'v' + require('./package.json').gramene.dbRelease;

module.exports = function (grunt) {
  require('jit-grunt')(grunt);

  grunt.initConfig({
    env: {
      dev: {
        NODE_ENV: 'development',
        isDev: true
      },
      prod: {
        NODE_ENV: 'production',
        isDev: false
      }
    },

    flow: {
      options: {
        style: 'color'
      }
    },

    exec: {
      generateStaticApp: {
        cmd: 'node scripts/babel.js'
      }
    },

    less: {
      dev: {
        options: {
          plugins: [
            new (require('less-plugin-autoprefix'))({browsers: ["last 2 versions"]})
          ]
        },
        files: {
          "build/style.css": "styles/main.less"
        }
      },
      production: {
        options: {
          plugins: [
            new (require('less-plugin-autoprefix'))({browsers: ["last 2 versions"]}),
            new (require('less-plugin-clean-css'))()
          ]
        },
        files: {
          "build/style.css": "styles/main.less"
        }
      }
    },

    browserify: {
      dev: {
        options: {
          browserifyOptions: {
            debug: true
          },
          transform: [
            ['babelify', {presets: ["es2015", "react"]}]
          ]
        },
        src: './scripts/gramoogle.js',
        dest: 'build/bundle.js'
      },
      production: {
        options: {
          transform: [
            ['babelify', {presets: ["es2015", "react"]}],
            ['uglifyify', {global: true}]
          ],
          browserifyOptions: {
            debug: false
          }
        },
        src: '<%= browserify.dev.src %>',
        dest: '<%= browserify.dev.dest %>'
      }
    },

    watch: {
      browserify: {
        files: ['scripts/**/*'],
        tasks: ['browserify:dev', 'generateStaticFiles']
      },
      html: {
        files: ['*.template.html'],
        tasks: ['packageIndexHtml']
      },
      styles: {
        files: ['styles/*.less'],
        tasks: ['less:dev']
      }
    },

    jasmine_node: {
      options: {
        forceExit: true,
        match: '.',
        matchall: false,
        extensions: 'js',
        specNameMatcher: 'spec'
      },
      all: ['spec/']
    },

    copy: {
      assets: {
        files: [
          {expand: true, cwd: 'assets/', src: ['**'], dest: 'build/assets/'}
        ]
      },
      icons: {
        files: [
          {expand: true, cwd: 'icons/favicons', src: ['**'], dest: 'build/'}
        ]
      }
    }
  });

  grunt.registerTask('packageIndexHtml', 'Build index.html for distribution.', function () {
    var footer = (function compileFooterTemplate() {
      function defaultServer() {
        const PROD_SERVER = 'http://data.gramene.org/';
        const DEV_SERVER = 'http://devdata.gramene.org/';
        var defaultServer;

        if (process.env.GRAMENE_SERVER) {
          defaultServer = process.env.GRAMENE_SERVER;
        }
        else if (props.tag || props.branch === 'master') {
          defaultServer = PROD_SERVER;
        }
        else {
          defaultServer = DEV_SERVER;
        }

        defaultServer += webserviceVersion + '/swagger';

        return defaultServer;
      }

      var template = _.template(grunt.file.read('./static/footer.template.html'));

      var props = {
        jobId: process.env.TRAVIS_JOB_ID,
        jobNumber: process.env.TRAVIS_JOB_NUMBER,
        branch: process.env.TRAVIS_BRANCH,
        tag: process.env.TRAVIS_TAG,
        user: process.env.USER,
        date: moment().format('MMMM Do YYYY [at] h:mm:ss a'),
        isDev: process.env.isDev
      };

      props.defaultServer = defaultServer();
      console.log("This build will use " + props.defaultServer + " as default web service server");

      return template(props);
    })();

    var index = (function compileIndexTemplate() {
      var template = _.template(grunt.file.read('./static/index.template.html'));
      var content = grunt.file.read('./static/app.html.fragment');
      var loadingMessage = grunt.file.read('./static/loading-message.html.fragment');

      var props = {
        footer: footer,
        content: content,
        loadingMessage: loadingMessage
      };

      return template(props);
    })();

    grunt.file.write('build/index.html', index);
  });
  grunt.registerTask('generateStaticFiles', ['copy:assets', 'copy:icons', 'exec:generateStaticApp', 'packageIndexHtml']);
  grunt.registerTask('test', ['jasmine_node']);
  grunt.registerTask('default', ['env:dev', 'generateStaticFiles', 'less:dev', 'browserify:dev', 'watch']);
  grunt.registerTask('package', ['env:prod', 'generateStaticFiles', 'less:production', 'browserify:production', 'test']);
};
