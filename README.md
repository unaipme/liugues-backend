# liugues API

The code uploaded in this repository belongs to the backend API of liugues web application. You can see it working at:

http://liugues-api.herokuapp.com/

### How does it work?

It uses a Node.js powered server and the Express.js framework to connect with the database. Then generates JSON with the standard JS functions and displays them.
Also has a homepage that can be accessed to check which functionalities are online and working.

### How to make it work locally?

You will need to have git, Node.js and npm installed in your computer. Once they are installed, clone this repository using `git clone https://github.com/unaipme/liugues-backend.git` command, in a directory that you have previously chosen.
After cloning the files, and without ever going to other directories, install all the dependencies of the API with `npm install`. To execute it with Node.js, use `npm start`.
The API needs and reads the following environment variables: DB_NAME, DB_HOST, DB_USER and DB_PASS.

### IMPORTANT NOTICE

This is only the backend part of the liugues project. You can see the repository that hosts the frontend part at:
https://gitlab.ida.liu.se/unape833/TDDD272016_coolestproject
https://github.com/unaipme/liugues-frontend