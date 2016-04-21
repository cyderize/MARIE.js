module.exports = function(grunt) {
    'use strict';

    require('load-grunt-tasks')(grunt);

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        open: {
            dev: {
                path: 'build/index.html'
            }
        },
        concat: {
            options: {
                separator: ';'
            },
            main: {
                src: [
                    'src/js/ext/jquery-*.js',
                    'src/js/ext/bootstrap.js',
                    'src/js/**/*.js'
                ],
                dest: 'working/marie.concat.js'
            }
        },
        regenerator: {
            options: {
                includeRuntime: true
            },
            main: {
                files: {
                    'working/marie.regenerate.js': 'working/marie.concat.js'
                }
            }
        },
        uglify: {
            main: {
                files: {
                    "build/js/marie.min.js": ['working/marie.regenerate.js']
                }
            }
        },
        ejs: {
            options: {
                version: "<%= pkg.version %>"
            },
            dist: {
                options: {
                    release: true
                },
                expand: true,
                cwd: 'src/templates/',
                src: ['*.ejs'],
                dest: 'build/',
                ext:  '.html'
            },
            dev: {
                options: {
                    release: false
                },
                expand: true,
                cwd: 'src/templates/',
                src: ['*.ejs'],
                dest: 'build/',
                ext:  '.html'
            }
        },
        copy: {
            dist: {
                expand: true,
                cwd: 'src/',
                src: ['**/*', '!**/templates/**', '!**/js/**'],
                dest: 'build/'
            },
            dev: {
                expand: true,
                cwd: 'src/',
                src: ['**/*', '!**/templates/**'],
                dest: 'build/'
            },
        },
        jshint: {
            options: {
                esversion: 6,
                browser: true,
                undef: true,
                unused: true,
                predef: ["$", "CodeMirror", "console", "module", "require"]
            },
            files: ['src/js/*.js', 'Gruntfile.js']
        },
        htmllint: {
            all: ["build/**/*.html"]
        },
        clean: ['build', 'working']
    });

    grunt.registerTask('build', ['clean', 'concat', 'regenerator', 'uglify', 'ejs:dist', 'copy:dist']);
    grunt.registerTask('build-dev', ['clean', 'ejs:dev', 'copy:dev']);
    grunt.registerTask('run', ['open:dev']);
    grunt.registerTask('bar', ['build', 'run']);
    grunt.registerTask('bar-dev', ['build-dev', 'run']);
    grunt.registerTask('test', ['clean', 'jshint', 'ejs:dev', 'htmllint']);
    grunt.registerTask('default', ['bar']);
};