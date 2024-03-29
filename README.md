# r-place-selfhosted-ui

Run a self hosted version of [r/place](https://www.reddit.com/r/place). This is the UI project. For the Server version [Click Here](https://github.com/yonixw/r-place-selfhosted-server)

![Example](public/readme_example.png)

## CodeSandbox Demo

👉 👉 👉  See how to get it running right away: https://youtu.be/5_Pc0r8Mipo

## How to Run

Open 2 command lines, 1 for server and 1 for client
* Client:
    * `git clone https://github.com/yonixw/r-place-selfhosted-ui`
    * `cd r-place-selfhosted-ui`
    *  `yarn install` (and not npm install)
    *  `yarn start` - will start react in `localhost:3000`
         *  If you have old node (before v18), run: `yarn startBefore16`
* Server:
    * `git clone https://github.com/yonixw/r-place-selfhosted-server`
    * `cd r-place-selfhosted-server`
    *  `yarn install` (and not npm install)
    *  `yarn start` - will start express in `localhost:8080`

Pass the server address as a param in the URL (and add `/websockets` after), for example:

```
Both HTTP-S
https://{ui-domain}/?server=wss://{server-domain}/websockets

Both HTTP (local development)
http://{ui-domain}/?server=ws://{server-domain}/websockets
```

Using local setup, this is the address to play:
`http://localhost:3000/?server=ws://localhost:8080/websockets`

**Note 1**: To get a public url to share with friends, I suggest to simply import it to CodeSandbox and publish with Vercel (for both client/server).

**Note 2**: The server need to be as secure as the UI (Chrome doesn't allow HTTP-**S** UI (front) => HTTP WebSocket (server) connections).

## Features

The canvas size is 1024x1024. With support for 24 colors.

Programmed fetures:

- Support mobile touch for drag
- User send pixel
- Server brodcast pixel to other users
- Server periodiclly saves the image to disk
- Server send "compressed" image to new users on connect
- Server send "compressed" image to old users every few minutes (not enforces, ui side)
- Throttle per IP

Missing features:

- Support mobile touch for zoom in/out
- Fast pixel paint for PC (Click on canvas or a key like `Space`)
- Captcha validation against bots
- Username or Nickname association with each pixel:
  - Saving to disk
     - Seperate long list of `(i) -> username`
     - And then dynamic bytes to point to index
         - Dynamic like in protobuff, that first bit in byte tells if under 126 o.w we expect another byte.
  - Sending for other Users who request it
     - Should be on request basis like another express ep `/getUser (x,y) -> string`

## Outbound Data Transfer Considerations

If you intend to run the sever on a public cloud (AWS, Azure, Hetzner etc..) Please consider the following data being downloaded for each command:

- Send pixel (per user) => 3 Bytes
- Send full image (per user) => 0.7 MB (Compressed from 4MB)

So, for example, if you expect max 10 users concurrent for 3 days, with
each user getting full canvas every 5 min, you will have a minimum of:

```
10 * (60 / 5) * 24 * 3 
= 8640 downloads, Or:
8640 * 0.7MB 
= 6GB of outbound data.
```

Currently Hetzner provide the cheapest option of a VM with 2cpu and 20TB outbound data for around 10 euro per month.

If you plan to run this from you home server, please notice you will have to send (with the same example as above) 504 MB of data every 5 minutes. Please assure your internet connection can support it.
