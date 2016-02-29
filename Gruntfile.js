'use strict';

var _ = require('lodash');
var moment = require('moment');

module.exports = function (grunt) {
  require('jit-grunt')(grunt);

  var lessifyOptions = {
    plugins: [
      new (require('less-plugin-autoprefix'))({browsers: ["last 2 versions"]})
    ]
  };

  grunt.initConfig({
    env: {
      dev: {
        NODE_ENV : 'development',
        isDev : true
      },
      prod: {
        NODE_ENV : 'production',
        isDev : false
      }
    },

    flow: {
      options: {
        style: 'color'
      }
    },

    browserify: {
      dev: {
        options: {
          browserifyOptions: {
            debug: true
          },
          transform: [
            ['node-lessify', lessifyOptions],
            ['babelify', {presets: ["es2015", "react"]}]
          ]
        },
        src: './scripts/gramoogle.js',
        dest: 'build/bundle.js'
      },
      production: {
        options: {
          transform: [
            ['node-lessify', lessifyOptions],
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
        files: ['scripts/**/*', 'styles/*.less'],
        tasks: ['browserify:dev', 'packageIndexHtml'],
        //options: {
        //  livereload: 8080
        //}
      },
      html: {
        files: ['*.template.html'],
        tasks: ['packageIndexHtml']
      }
    },

    //jest: {
    //  options: {
    //    coverage: false,
    //    config: './jest.config.json'
    //  }
    //},

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
      var template = _.template(grunt.file.read('./footer.template.html'));

      var props = {
        jobId: process.env.TRAVIS_JOB_ID,
        jobNumber: process.env.TRAVIS_JOB_NUMBER,
        branch: process.env.TRAVIS_BRANCH,
        tag: process.env.TRAVIS_TAG,
        user: process.env.USER,
        date: moment().format('MMMM Do YYYY [at] h:mm:ss a'),
        isDev: process.env.isDev
      };

      props.defaultServer = (props.tag || props.branch === 'master') ? '"http://data.gramene.org/swagger"' : '"http://devdata.gramene.org/swagger"';
      console.log("This build will use " + props.defaultServer + " as default web service server");

      return template(props);
    })();

    var index = (function compileIndexTemplate() {
      var template = _.template(grunt.file.read('./index.template.html'));

      var props = {
        footer: footer
      };

      return template(props);
    })();

    grunt.file.write('build/index.html', index);
  });

  grunt.registerTask('test', ['jasmine_node']);
  grunt.registerTask('default', ['env:dev', 'copy:assets', 'copy:icons', 'packageIndexHtml', 'browserify:dev', 'watch']);
  grunt.registerTask('package', ['env:prod', 'copy:assets', 'copy:icons', 'packageIndexHtml', 'browserify:production', 'test']);
};
