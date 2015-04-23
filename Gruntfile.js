'use strict';

module.exports = function (grunt) {
  require('jit-grunt')(grunt);

  grunt.loadNpmTasks('grunt-jest');
  grunt.loadNpmTasks('grunt-jsxhint');
  grunt.loadNpmTasks('grunt-concat-css');

  grunt.initConfig({
    less: {
      development: {
        options: {
          compress: false,
          yuicompress: true,
          optimization: 2,
          sourceMap: true,
          sourceMapFileInline: true
        },
        plugins: [
          new (require('less-plugin-autoprefix'))({browsers: ["last 2 versions"]})
        ],
        files: {
          "build/less-style.css": "styles/main.less"
        }
      }
    },

    concat_css: {
      options: {
        // Task-specific options go here.
      },
      all: {
        src: ['node_modules/bootstrap/dist/css/bootstrap.css', 'build/less-style.css'],
        dest: 'build/style.css'
      },
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
        tasks: ['less', 'concat_css'],
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

  grunt.registerTask('default', ['less', 'concat_css', 'browserify:dev', 'watch']);
  grunt.registerTask('package', ['jest', 'less', 'concat_css', 'browserify:production']);
};
