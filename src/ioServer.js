const { Server } = require('socket.io');
const Match = require('./deliveroo/Match')
const AuthenticationUnique = require('./deliveroo/AuthenticationUnique');
const myClock = require('./deliveroo/Clock');

const myAuthenticatorUnique = new AuthenticationUnique; 

const io = new Server( {
    cors: {
        origin: "*", // http://localhost:3000",
        methods: ["GET", "POST"]
    }
} );


//GAmes di default 
var options1 = {
    mappa:'loops',
    random_mov_agents: 0,
    random_agent_speed: '10s',
    parcels_generation_interval: '1s',
    parcels_max: 'inifinte',
    parcel_rewar_avg: 300,
    parcel_reward_variance: 10,
    parcel_decading_interval: 'infinite',
    agents_observation_distance: 10,
    parcels_observation_distance: 10,
    movement_duration: 400
}
var options2 = {
    mappa:'loops',
    random_mov_agents: 0,
    random_agent_speed: '10s',
    parcels_generation_interval: '1s',
    parcels_max: 'inifinte',
    parcel_rewar_avg: 300,
    parcel_reward_variance: 10,
    parcel_decading_interval: '1s', 
    agents_observation_distance: 5,
    parcels_observation_distance: 5,
    movement_duration: 50
}

// match di default
var game0 = new Match(options1,'0');
var game1 = new Match(options2,'1');
console.log("\nLista Matchs: ");
Match.mapMatch.forEach( match => console.log("\tMatch ", match.id + " with map: ", match.options.mappa));


// Gestione connessioni 
io.on('connection', (socket) => {

    // stampo la rihiesta di connessione     
    console.log("\nConnection socket:", socket.id + " to match:", socket.handshake.headers['match'] )
    if(socket.handshake.headers['x-token']){
        console.log("with token: ", socket.handshake.headers['x-token'].slice(-30))
    }else{
        console.log("with'out token")
    }

    var match = Match.mapMatch.get(socket.handshake.headers['match']);
    const me = myAuthenticatorUnique.authenticate(match, socket)
    
    if ( !me ) return;
    socket.broadcast.emit( 'hi ', socket.id, me.id, me.name );


    /**
     * Config
     */
    if ( me.name == 'god' ) { // 'god' mod
        me.config.PARCELS_OBSERVATION_DISTANCE = 'infinite'
        me.config.AGENTS_OBSERVATION_DISTANCE = 'infinite'
    }
    socket.emit( 'config', me.config )


    /**
     * Game Join
    */
    match.join(socket, me)

      
    /**
     * Actions
     */
    
    socket.on('move', async (direction, acknowledgementCallback) => {
        // console.log(me.id, me.x, me.y, direction);
        try {
            const moving = me[direction]();
            if ( acknowledgementCallback )
                acknowledgementCallback( await moving ); //.bind(me)()
        } catch (error) { console.error(direction, 'is not a method of agent'); console.error(error) }
    });

    socket.on('pickup', async (acknowledgementCallback) => {
        const picked = await me.pickUp()
        if ( acknowledgementCallback )
            try {
                acknowledgementCallback( picked )
            } catch (error) { console.error(error) }
    });

    socket.on('putdown', async (selected, acknowledgementCallback) => {
        const dropped = await me.putDown( selected )
        if ( acknowledgementCallback )
            try {
                acknowledgementCallback( dropped )
            } catch (error) { console.error(error) }
    });

    
    /**
     * Path
     */
    
    socket.on( 'path', ( path ) => {
        
        for ( let s of myAuthenticator.getSockets( me.id )() ) {

            if ( s == socket )
                continue;
            
            s.emit( 'path', path );

        }

    } )


    
    /**
     * Bradcast client log
     */
    socket.on( 'log', ( ...message ) => {
        socket.broadcast.emit( 'log', {src: 'client', timestamp: myClock.ms, socket: socket.id, id: me.id, name: me.name}, ...message )
    } )




    socket.on( 'draw', async (bufferPng) => {
        // console.log( 'draw' );
        for ( let s of myAuthenticator.getSockets( me.id )() ) {
            if ( s == socket )
                continue;
            s.emit( 'draw', {src: 'client', timestamp: myClock.ms, socket: socket.id, id: me.id, name: me.name}, bufferPng );
        }
        // socket.broadcast.emit( 'draw', {src: 'client', timestamp: myClock.ms, socket: socket.id, id: me.id, name: me.name}, bufferPng );
    } );

});





/**
 * Bradcast server log
 */
const oldLog = console.log;
console.log = function ( ...message ) {
    io.emit( 'log', {src: 'server', timestamp: myClock.ms}, ...message );
    oldLog.apply( console, message );
};



module.exports = io;