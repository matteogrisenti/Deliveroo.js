const Grid = require('./Grid');
const RandomlyMoveAgent = require('../workers/randomlyMovingAgent');
const parcelsGenerator = require('../workers/parcelsGenerator');
const { uid } = require('uid');
const Config = require('./Config');
const { SensorInterface } = require('./InterfaceController');
const Agent = require('./Agent');
const Leaderboard = require('./Leaderboard');
const Timer = require('./Timer');


// enum for the status of the match
const MatchStatus = {
    STOP: 'stop',
    PLAY: 'play',
};

class Match {

    /** @type {Config} config */
    config;

     /** @type {MatchStatus} config */
    #status;
    get status () {  return this.#status; }

    /** @type {string} #id */    
    #id;
    get id () { return this.#id; }

    /** @type {Grid} grid */
    grid;

    /** @type {parcelsGenerator} */
    #parcelsGenerator;

    /** @type {randomlyMovingAgent[]} */
    #randomlyMovingAgents;

    // /** @type {Map<string,{agent:Agent,sockets:Set<Socket>}>} idToAgentAndSockets */
    // #idToAgentAndSockets = new Map();

    /** @type {Map<string,Set<Agent>} agents in each team */
    #teamsAgents = new Map();

    /** @type {Timer} timer of the match */
    #timer;

    /**
     * @param {Config} config 
     * @param {string} id 
     */
    constructor ( config = new Config(), id = uid(4) )  {

        this.config = config;
        this.#id = id;
        this.#status = MatchStatus.STOP

        // Create and start the timer of the match
        this.#timer = new Timer(config.MATCH_TIMEOUT);

        // Load map
        let map = require( '../../levels/maps/' + this.config.MAP_FILE + '.json' );
        this.grid = new Grid( this.#id, config, map.map );

        // Parcels generator
        this.#parcelsGenerator = new parcelsGenerator( this.config, this.grid );
        
        // Randomly moving agents
        this.#randomlyMovingAgents = [];
        for (let i = 0; i < this.config.RANDOMLY_MOVING_AGENTS; i++) {
            let randomlyMoveAgent = new RandomlyMoveAgent( this.config, this.grid );
            this.#randomlyMovingAgents.push( randomlyMoveAgent );
        }

        // listeners to the event of the timer
        this.#timer.on('timer update', (remainingTime) => { 
            console.log(remainingTime) /* print for debug */
            this.grid.emit('timer update',remainingTime);  
        })
        this.#timer.on('timer started', () => { console.log('timer started') /* print for debug */ })
        this.#timer.on('timer stopped', () => { console.log('timer stopped') /* print for debug */ })
        this.#timer.on('timer ended', () => {
            console.log('timer of match ', this.#id +' ended')
            this.#status = MatchStatus.STOP
            this.grid.emit('match ended');
            this.destroy();
        })
        

        console.log('Id match: ', this.#id + ' timeot: ', config.MATCH_TIMEOUT)

        
    
        // Connect match to leaderboard
        this.grid.on( 'agent rewarded', (agent, reward) => {
            Leaderboard.addReward( this.#id, agent.team, agent.id, agent.name, reward );
        } );

        this.grid.on( 'agent created', (agent) => {
            console.log("AGENT CREATED")
            Leaderboard.addReward( this.#id, agent.team, agent.id,agent.name, 0 );
        } );

        // // quando il punteggio di un agente cambia solleva l'evento agent info
        // this.#grid.on('agente score', (id, name, team, score) => {
        //     this.emit('agent info', id, name, team, score);
        // });

        // Logs
        console.log("Started match "+this.#id);

        // this.on('agent info', (id, name, team, score) => {
        //     console.log("Agente ", id + " ", name + " of team:", team + " change score into ", +score)
        // });
        // this.on('team info', (name, score) => {
        //     console.log("Team ", name + " change score into ", +score)
        // });
        
    }

    // PROBLEMA NON VIENE ESEGUITA IN MODOD SINCRONO 
    async destroy() {
        // Stoppa il movimento degli agenti
        await Promise.all(this.#randomlyMovingAgents.map(a => a.stopAgentMovement()));
    
        // Distruggi il myClock
        await this.#parcelsGenerator.destroy();
    
        // Distruggi la griglia
        await this.grid.destroy();
    
        // Altri codici di distruzione...
    }

    getOrCreateAgent ( id, name, team = uid(4) ) {
        
        // Agent
        //console.log(this.grid.getAgents())
        var me = this.grid.getAgent( id );
        if ( ! me ){
            me = this.grid.createAgent( {id, name, team} );
        }
            
        // Team
        var teamMates = this.#teamsAgents.get( team );
        if ( ! teamMates ) {
            teamMates = new Set();
            this.#teamsAgents.set( team, teamMates );
        }
        if ( ! teamMates.has( me ) ) {
            teamMates.add( me );
        }
        
        // this.#teamsAgents.forEach( (agents,team) => {
        //     let teamScore = Array.from(agents).reduce( (sum,a) => a.sccore );
        //     let listOfAgentsString = Array.from( agents.values() ).map( a => a.name ).join(', ');
        //     console.log(`\t ${team} score: ${teamScore}, agents: ${listOfAgentsString}`);
        // } );

        return me;
    }

    strtStopMatch(){
        if(this.#status == MatchStatus.PLAY){ this.#status = MatchStatus.STOP; this.#timer.stop();  return; }
        if(this.#status == MatchStatus.STOP){ this.#status = MatchStatus.PLAY; this.#timer.start(); return; }
    }


}


module.exports = Match;
