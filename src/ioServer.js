const { Server, Namespace } = require('socket.io');
const Room = require('./deliveroo/Room')
const myClock = require('./deliveroo/Clock');
const Config = require('./deliveroo/Config');
const jwt = require('jsonwebtoken');
const Arena = require('./deliveroo/Arena');
const Agent = require('./deliveroo/Agent');
const Grid = require('./deliveroo/Grid');
const Leaderboard = require('./deliveroo/Leaderboard');



/**
 * @typedef { { me:{id,name,team,x,y}, agents:[{id,name,team,x,y,score}], parcels:[{x,y,type}] } } Status
 */

const SUPER_SECRET = process.env.SUPER_SECRET || 'default_token_private_key';



class ioServer {

    /** @type {Config} */
    #config = new Config();

    /** @type {Server} */
    #io;

    constructor( httpServer ) {
        
        const defaultRoom = Arena.createRoom(); // with default config
        defaultRoom.match.startStopGame();
        
        /**
         * Server Socket.IO
         */
        const io = this.#io = new Server( httpServer, {
            cors: {
                origin: ['http://localhost:5173'], // http://localhost:3000",
                // origin: (_req, callback) => {
                //     callback(null, true);
                // },
                credentials: true,
                allowedHeaders: ["x-token", "*"],
                methods: ["GET", "POST"]
            }
        } );

        /**
         * Check authorization token
         */
        io.engine.use( (req, res, next) => {
            const isHandshake = req._query.sid === undefined;
            if (!isHandshake) {
                return next();
            }
            // console.log( `Check token at Handshake` );
        
            var token = req.headers['x-token'];
        
            if (!token) {
                console.log( `Login failure. Token not provided.` );
                return next(new Error(`Login failure. Token not provided.`));
            }
            
            const socketId = req.id;
            jwt.verify(token, SUPER_SECRET, (err, decoded) => {
                //console.log(decoded);
                if (err) {
                    console.log( `Socket ${socketId} log in failure. Invalid token provided.` );
                } else if ( decoded.id && decoded.name ) {
                    const id = decoded.id
                    const name = decoded.name
                    const teamId = decoded.teamId || null;
                    const teamName = decoded.teamName || null;
                    req.user = { id, name, teamId, teamName, token };
                    // console.log( `Socket ${socketId} connecting as ${name}(${id}). With token: ...${token.slice(-30)}` );
                    next();
                }
                else {
                    console.log( `Socket ${socketId} log in failure. Token is verified but id or name are missing.` );
                }
            });

        } );

        /**
         * Listen to match namespaces
         * https://socket.io/docs/v4/server-api/#namespace
         */
        const parentNamespace = io.of( (name, auth, next) => {
            console.log( `Check match namespace ${name}` ); // name includes the '/'
            next(null, true); // or false, when the creation is denied
        }).on('connection', async (socket) => {

            const id = socket.request.user.id;
            const name = socket.request.user.name;
            const teamId = socket.request.user.teamId;
            const teamName = socket.request.user.teamName;
            const token = socket.request.user.token;
            const roomTitle = socket.nsp.name.split('/').pop();

            // if the socket try to cennect to a match that not exist we block the connection 
            if(!Arena.getRoom( roomTitle )){
                console.log( `socket ${socket.id} try to connected to room ${roomTitle} that not exist` );
                socket.disconnect();
                return;
            }

            // if the socket try to cennect to a match that not exist we block the connection 
            if(Arena.getRoom( roomTitle ).match.status == 'end'){
                console.log( `socket ${socket.id} try to connected to a room ${roomTitle} that contain an ended match with and ended match` );
                socket.disconnect();
                return;
            }
            
            await socket.join("team:"+teamId);
            await socket.join("agent:"+id);

            console.log( `Socket ${socket.id} connecting as ${name}(${id})(${teamName}) to room ${roomTitle}, with token: ...${token.slice(-30)}` );

            const roomNamespace = socket.nsp;
            const teamRoom = roomNamespace.in("team:"+teamId);
            const agentRoom = roomNamespace.in("agent:"+id);

            const room = Arena.getRoom( roomTitle ); // with default config
            // const team = new Team();
            const me = room.getOrCreateAgent( socket.request.user );

            console.log( `/${room.id} socket ${socket.id} connected as ${me.name}-${me.teamName}-${me.id}` );
            
            // let socketsInAgentRoom = await agentRoom.fetchSockets();
            // console.log( socketsInAgentRoom.length, 'sockets in room', "agent:"+id, "at", matchTitle)

            ioServer.listenToGameEventsAndForwardToSocket( socket, me, room.match.grid, room, roomNamespace );
            ioServer.listenSocketEventsAndForwardToGame( me, socket, agentRoom, teamRoom, roomNamespace );

            /**
             * on Disconnect
             */
            socket.on( 'disconnect', async (cause) => {

                // if the disconection is occured becouse the match is ended we don't have to make all the check
                //console.log('cause : ', cause)
                if(cause === 'server namespace disconnect'){ console.log('\t\tsocket ', socket.id + ' disconected'); return}

                try{
                    let socketsLeft = (await agentRoom.fetchSockets()).length;
                    console.log( `/${room.id}/${me.name}-${me.teamName}-${me.id} Socket disconnected.`,
                        socketsLeft ?
                        `Other ${socketsLeft} connections to the agent.` :
                        `No other connections, agent will be removed in ${this.#config.AGENT_TIMEOUT/1000} seconds.`
                    );
                    if ( socketsLeft == 0 && room.match.grid.getAgent(me.id) ) {
                        
                        // console.log( `/${match.id}/${me.name}-${me.team}-${me.id} No connection left. In ${this.#config.AGENT_TIMEOUT/1000} seconds agent will be removed.` );
                        await new Promise( res => setTimeout(res, this.#config.AGENT_TIMEOUT) );
                        
                        // if in this 10 seconds the match end we stop the action
                        if(room.match.status == 'end'){/*console.log('interrupt action, match ended')*/; return}

                        let socketsLeft = (await agentRoom.fetchSockets()).length;
                        if ( socketsLeft == 0 && room.match.grid.getAgent(me.id) ) {
                            console.log( `/${room.id}/${me.name}-${me.teamName}-${me.id} Agent deleted after ${this.#config.AGENT_TIMEOUT/1000} seconds of no connections` );
                            room.match.grid.deleteAgent ( me );
                        };
                    }
                }catch(error){
                    console.log('Error in the disconection of socket ', socket.id, ' -> ', error)
                }
                
            });
            
        });

        /**
         * Broadcast server log
         */
        const oldLog = console.log;
        console.log = function ( ...message ) {
            io.emit( 'log', {src: 'server', timestamp: myClock.ms}, ...message );
            oldLog.apply( console, message );
        };

    }



    /**
     * @param {Socket} socket 
     * @param {Agent} me 
     * @param {Grid} grid
     * @param {Match} match
     */
    static listenToGameEventsAndForwardToSocket ( socket, me, grid, room, roomNamespace ) {

        /**
         * Config
         */
        if ( me.name == 'god' ) { // 'god' mod
            me.config.PARCELS_OBSERVATION_DISTANCE = 'infinite'
            me.config.AGENTS_OBSERVATION_DISTANCE = 'infinite'
        }
        socket.emit( 'config', me.config )
        
        //Emit map (tiles)
        grid.on( 'tile', ({x, y, delivery, blocked, parcelSpawner}) => {
            // console.log( 'emit tile', x, y, delivery, parcelSpawner );
            if (!blocked)
                socket.emit( 'tile', x, y, delivery, parcelSpawner );
            else
                socket.emit( 'not_tile', x, y );
        } );

        let tiles = []
        for (const {x, y, delivery, blocked, parcelSpawner} of grid.getTiles()) {
            if ( !blocked ) {
                socket.emit( 'tile', x, y, delivery, parcelSpawner )
                tiles.push( {x, y, delivery, parcelSpawner} )
            } else
                socket.emit( 'not_tile', x, y );
        }
        let {width, height} = grid.getMapSize()
        socket.emit( 'map', width, height, tiles )


        //Emit you
        me.on( 'agent', ({id, name, teamId, teamName, x, y, score}) => {       
            //console.log("Dati agent 1: ", id, name, teamId, teamName, x, y, score)
            socket.emit( 'you', id, name, teamId, teamName, x, y, score );
        } );
        
        //console.log("Dati agent 2: ", me.id, me.name, me.teamId, me.teamName, me.x, me.y, me.score)
        socket.emit( 'you', me.id, me.name, me.teamId, me.teamName, me.x, me.y, me.score );

        grid.on('agent deleted', ( who ) => {
            // console.log("Agent ", who.name + " deleted")
            // if(who.team && this.#teamsAgents.has(who.team)){
            //     this.#teamsAgents.get(who.team).removeAgent(who.id)
            // }
            socket.emit("agent deleted", who.id, who.team)
        })

        socket.emit("timer update", room.match.timer.remainingTime)
        grid.on('timer update', (time) => { socket.emit("timer update", time) })
        grid.on('match ended', async (matchId) => { socket.emit("match ended") })

              
        /**
         * Emit sensing
         */

        // Parcels
        me.on( 'parcels sensing', (parcels) => {
            // console.log('emit parcels sensing', ...parcels);
            socket.emit('parcels sensing', parcels )
        } );
        me.emitParcelSensing();

        // Agents
        me.on( 'agents sensing', (agents) => {
            // console.log('emit agents sensing', ...agents); // {id, name, x, y, score}
            socket.emit( 'agents sensing', agents );
        } );
        me.emitAgentSensing();

        /**
         * GOD mod
         */
        if ( me.name == 'god' ) {

            socket.on( 'create parcel', async (x, y) => {
                console.log( 'create parcel', x, y )
                grid.createParcel(x, y)
            } );

            socket.on( 'dispose parcel', async (x, y) => {
                console.log( 'dispose parcel', x, y )
                let parcels = Array.from(grid.getParcels()).filter( p => p.x == x && p.y == y );
                for ( p of parcels)
                    grid.deleteParcel( p.id )
                grid.emit( 'parcel' );
            } );

            socket.on( 'tile', async (x, y) => {
                console.log( 'create/dispose tile', x, y )
                let tile = grid.getTile(x, y)
                
                if ( !tile ) return;
                
                if ( tile.blocked ) {
                    tile.delivery = false;
                    tile.parcelSpawner = true;
                    tile.unblock();
                } else if ( tile.parcelSpawner ) {
                    tile.delivery = true;
                    tile.parcelSpawner = false;
                } else if ( tile.delivery ) {
                    tile.delivery = false;
                    tile.parcelSpawner = false;
                } else {
                    tile.delivery = false;
                    tile.parcelSpawner = false;
                    tile.block();
                }
            } );

        }

        // Leaderboard
        grid.on( 'agent rewarded', async (agent, reward) => {
            
            let matchId = grid.matchId
            let agentId = agent.id
            let dataAgent = await Leaderboard.get({matchId, agentId})
            let dataTeam;

            if(agent.teamName != 'no-team'){
                //console.log('team:' , agent.teamName)
                let teamId = agent.teamId
                dataTeam = await Leaderboard.get({matchId, teamId},['teamId']);
                dataTeam = dataTeam[0]
            }

            //console.log('agent reWard, agent id: ', agent.id + " -> ", dataAgent[0])
            //console.log('team reWard:' , dataTeam)

            socket.emit( 'leaderboard', dataAgent[0], dataTeam);
        });

    }



    /**
     * @param {Agent} me
     * @param {Socket} socket
     * @param {BroadcastOperator} agentRoom
     * @param {BroadcastOperator} teamRoom
     * @param {Namespace} matchNamespace
     */
    static listenSocketEventsAndForwardToGame ( me, socket, agentRoom, teamRoom, roomNamespace ) {
        
        
        /**
         * Actions
         */
        socket.on('move', async (direction, acknowledgementCallback) => {

            // Before move the agent check if the match is n stop status or play one.
            let roomId = roomNamespace.name
            if (roomId.startsWith("/")) { roomId = roomId.slice(1); }  // Remove the first '/' 
            let room = Arena.getRoom( roomId ); 
            if(room == false) { console.log('Received move request for an not existing room: ', roomId); return};
            if(room.match.status == 'end') { console.log('Received move request for a ended match in room: ', roomId); return};


            if(room.match.status == 'stop'){  
                console.log('Motion disable becouse the match of the room ', roomId + ' status is stop')
                if ( acknowledgementCallback ) acknowledgementCallback( 'Match is in stop staus' ); 
                return;
            }

            console.log( `${roomNamespace.name}/${me.name}-${me.teamName}-${me.id}`, me.x, me.y, direction );
            try {
                const moving = me[direction]();
                if ( acknowledgementCallback )
                    acknowledgementCallback( await moving ); //.bind(me)()
            } catch (error) { console.error(direction, 'is not a method of agent'); console.error(error) }
        });

        socket.on('pickup', async (acknowledgementCallback) => {

             // Before move the agent check if the match is n stop status or play one.
             let roomId = roomNamespace.name
             if (roomId.startsWith("/")) { roomId = roomId.slice(1); }  // Remove the first '/' 
             let room = Arena.getRoom( roomId ); 
             if(room == false) { console.log('Received pickup request for an not existing room: ', roomId); return};
             if(room.match.status == 'end') { console.log('Received pickup request for a ended match in room: ', roomId); return};


            if(room.match.status == 'stop'){  
                console.log('PickUp disable becouse the game in Match ', matchId + ' status is stop')
                if ( acknowledgementCallback ) acknowledgementCallback( 'Match is in stop staus' ); 
                return;
            }

            const picked = await me.pickUp()
            
            console.log( `${roomNamespace.name}/${me.name}-${me.teamName}-${me.id} pickup ${picked.length} parcels` );
            
            if ( acknowledgementCallback )
                try {
                    acknowledgementCallback( picked )
                } catch (error) { console.error(error) }
        });

        socket.on('putdown', async (selected, acknowledgementCallback) => {

             // Before move the agent check if the match is n stop status or play one.
            let roomId = roomNamespace.name
            if (roomId.startsWith("/")) { roomId = roomId.slice(1); }   // Remove the first '/' 
            let room = Arena.getRoom( roomId );
            if(room == false) { console.log('Received putdown request for an not existing room: ', roomId); return};
            if(room.match.status == 'end') { console.log('Received putdown request for a ended match in room: ', roomId); return};

            if(room.match.status == 'stop'){  
                console.log('PutDown disable becouse the match in room ', roomId + ' status is stop')
                if ( acknowledgementCallback ) acknowledgementCallback( 'Match is in stop staus' ); 
                return;
            }

            const {dropped, reward} = await me.putDown( selected );

            console.log( `${roomNamespace.name}/${me.name}-${me.teamName}-${me.id} putdown ${dropped.length} parcels (+ ${reward} pti -> ${me.score} pti)` );
            
            if ( acknowledgementCallback )
                try {
                    acknowledgementCallback( dropped )
                } catch (error) { console.error(error) }
        });



        /**
         * Communication
         */

        socket.on( 'say', (toId, msg, acknowledgementCallback) => {
            
            console.log( me.id, me.name, me.teamId, 'say ', toId, msg );

            roomNamespace
            .in("agent:"+toId)
            .emit( 'msg', me.id, me.name, me.teamId, msg );

            try {
                if (acknowledgementCallback) acknowledgementCallback( 'successful' )
            } catch (error) { console.log( me.id, 'acknowledgement of \'say\' not possible' ) }

        } )

        socket.on( 'ask', (toId, msg, replyCallback) => {
            console.log( me.id, me.name, me.teamId, 'ask', toId, msg );

            roomNamespace
            .in("agent:"+toId)
            .emit( 'msg', me.id, me.name, me.teamId, msg, (reply) => {
                try {
                    console.log( toId, 'replied', reply );
                    replyCallback( reply )
                } catch (error) { console.log( me.id, 'error while trying to acknowledge reply' ) }
            } );

        } )

        socket.on( 'shout', (msg, acknowledgementCallback) => {

            console.log( me.id, me.name, me.teamId, 'shout', msg );

            roomNamespace
            .emit( 'msg', me.id, me.name, me.teamId, msg );

            try {
                if (acknowledgementCallback) acknowledgementCallback( 'successful' )
            } catch (error) { console.log( me.id, 'acknowledgement of \'shout\' not possible' ) }
            
        } )


        
        /**
         * Path
         */
        
        socket.on( 'path', ( path ) => {
            agentRoom.emit( 'path', path );
        } )


        
        /**
         * Bradcast client log
         */
        socket.on( 'log', ( ...message ) => {
            roomNamespace.emit( 'log', {src: 'client', timestamp: myClock.ms, socket: socket.id, id: me.id, name: me.name}, ...message )
        } )




        socket.on( 'draw', async (bufferPng) => {
            // console.log( 'draw' );
            
            roomNamespace
            .in("agent:"+toId)
            .emit( 'draw', {src: 'client', timestamp: myClock.ms, socket: socket.id, id: me.id, name: me.name}, bufferPng );
            
        } );

    }


}



module.exports = ioServer;