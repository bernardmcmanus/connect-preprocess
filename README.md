connect-preprocess
==================

> flexible preprocessor middleware for connect / express.

Installation
------------
    npm install connect

Basic Use
---------
```javascript
var connect = require( 'connect' );
var Preprocessor = require( 'connect-preprocess' );
var engine = require( 'some-preprocessor-engine' );

var server = connect.createServer();
server.use( Preprocessor({ engine: engine }));
```

Options
-------
| Parameter | Type | Description | Default |
| --------- | ---- | ----------- | ------- |
| `accept` | `Array` | File types to preprocess | `[ 'html' , 'css' , 'js' ]` |
| `engine` | `Function` | The preprocessor engine | `function(str){return str}` |

Examples
--------

### grunt connect plugin

* ###### Gruntfile.js
    ```javascript
    var Preprocessor = require( 'connect-preprocess' );

    grunt.initConfig({
      // ...
      connect: {
        options: { port: 9000 },
        server: {
          options: {
            middleware: function ( connect , options , middlewares ) {
              middlewares.unshift( Preprocessor({ engine: grunt.config.process }));
              return middlewares;
            }
          }
        }
      },
      // ...
    });
    ```

* ###### example.html
    ```html
    <!DOCTYPE HTML>
    <html>
    <head>
        <title><%= pkg.name %></title>
        <script src="<%= pkg.main %>"></script>
    </head>
    <body>
        <a href="<%= pkg.homepage %>">visit the homepage!</a>
    </body>
    </html>
    ```

* ###### result
    ```html
    <!DOCTYPE HTML>
    <html>
    <head>
        <title>connect-preprocess</title>
        <script src="index.js"></script>
    </head>
    <body>
        <a href="https://github.com/elnarddogg/connect-preprocess">visit the homepage!</a>
    </body>
    </html>
    ```
