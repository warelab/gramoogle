'use strict';

var _ = require('lodash');

var pkg = require('./package.json');

module.exports = function (grunt) {
  require('jit-grunt')(grunt);
  require('matchdep').filterAll('grunt-*').forEach(grunt.loadNpmTasks);

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
            ['babelify']
          ]
        },
        src: './scripts/gramoogle.js',
        dest: 'build/bundle.js'
      },
      production: {
        options: {
          transform: [
            ['node-lessify', lessifyOptions],
            ['babelify'],
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

    jest: {
      options: {
        coverage: false,
        config: './jest.config.json'
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
      }
    }
  });

  grunt.registerTask('packageIndexHtml', 'Build index.html for distribution.', function () {

    var footer = (function compileFooterTemplate() {
      var template = _.template(grunt.file.read('./footer.template.html'));

      var props = {
        version: pkg.version,
        buildId: process.env.TRAVIS_BUILD_ID,
        buildNumber: process.env.TRAVIS_BUILD_NUMBER,
        branch: process.env.TRAVIS_BRANCH,
        user: process.env.USER,
        date: new Date().toJSON().substring(0, 10),
        isDev: process.env.isDev
      };

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
  grunt.registerTask('default', ['env:dev', 'copy:assets', 'packageIndexHtml', 'browserify:dev', 'watch']);
  grunt.registerTask('package', ['env:prod', 'copy:assets', 'packageIndexHtml', 'browserify:production', 'test']);
};
