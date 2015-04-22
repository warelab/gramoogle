'use strict';

module.exports = function (grunt) {
  require('jit-grunt')(grunt);
  var browserslist = require('browserslist');

  grunt.loadNpmTasks('grunt-jest');
  grunt.loadNpmTasks('grunt-jsxhint');

  grunt.initConfig({
    less: {
      development: {
        options: {
          compress: false,
          yuicompress: true,
          optimization: 2,
          sourceMap: true
        },
        plugins: [
          new (require('less-plugin-autoprefix'))({browsers: ["last 2 versions"]})
        ],
        files: {
          "build/style.css": "styles/main.less"
        }
      }
    },
    autoprefixer: {
      options: {
        // Task-specific options go here.
      },
      less_css_file: {
        options: {
          diff: true,
          map: { inline: false }
        },
        src: 'build/style.css'
      }
    },
    browserify: {
      options: {
        browserifyOptions: {
          debug: true
        },
        transform: ['reactify']
      },
      dev: {
        src: './index.js',
        dest: 'build/bundle.js'
      },
      production: {
        browserifyOptions: {
          debug: false
        },
        src: '<%= browserify.dev.src %>',
        dest: 'build/bundle.js'
      }
    },

    watch: {
      styles: {
        files: ['styles/*.less'],
        tasks: ['less'],
        options: {
          nospawn: true
        }
      },

      browserify: {
        files: 'scripts/**/*',
        tasks: ['browserify:dev']
      }
    },

    jest: {
      options: {
        coverage: false,
        config: './jest.config.json'
      }
    },

    jshint: {
      all: ['Gruntfile.js', 'scripts/**/*'],
      options: {
        jshintrc: true,
        reporter: require('jshint-stylish')
      }
    }
  });

  grunt.registerTask('default', ['less', 'browserify:dev', 'watch']);
  grunt.registerTask('package', ['jest', 'less', 'browserify:production']);
};
