# Deliveroo.js

## Autonomous Software Agents

Marco Robol - marco.robol@unitn.it

University of Trento - 2022/2023

## FUNZIONAMENTO
### 1) CONNESSIONE Client-Server:
![Image text](/README-Image/Immagine-Funzionamento.PNG)
#### Il Client
fa il set-up della connessione:
Controlla i parametri dell’URL alla ricerca del parametro name che viene usato per inizializzare la variabile name. Se il parametro è presente vuol dire che la socket è già collegata ad un agente nel gioco, altrimenti vuol dire che è una nuova socket.

Se il parametro name non è presente allora viene mostrato a schermo un pop-up in cui è richiesto all’utente di inserire un nome: il valore inserito viene salvato in name.

Dichiara la variabile token e la inizializza con il valore ritornato dal checkCookieForToken(name), che controlla se esiste il cookie ‘token_’+name:
se si ritorna il valore associato; se no ritorna il valore di default: “”

Inizializza la variabile socket con una connessione Socket.IO definendo vari attributi nelle sezioni:
sezione extraHeaders definisce l’attributo ‘x_token’ e lo inizializza con token
sezione query definisce l’attributo ‘name’ e lo inizializza con il parametro name dell’URL

Infine inizializza la variabile me con un agente default: getOrCreateAgent('loading',name,0,0,0)

#### Il Server:
chiama il metodo authenticate(socket)che:
controlla se nella richiesta di connessione sia stato allegato un token.

    SI: decodifica il token ed estrae le variabili id e name; che si riferiscono all’agente associato alla socket. 

    NO: estrae la variabile name dalla richiesta di connessione e genera un valore unico che viene salvato nella variabile id.  
        Poi crea un nuovo token includendo le variabili name ed id e definirlo sulla base della chiave SUPERSECRET. Il token viene inviato al client mediante il segnale socket.’token’. 

chiama il metodo registerSocketAndGetAgent(id,name,socket)che associa all’agente sulla griglia di gioco corrispondente a id con la socket, eventualmente crea un agente nuovo. 
Le associazioni tra socket ed id degli agenti sono salvati nella mappa  idToAgentAndSockets dell’istanza myAuthenticator.

1.b) Se viene emesso il segnale socket.’token’dal server il client slava l’attributo token nel cookie ‘token_’+name. 

### 2) EMISSIONE dei dati di MyGrid

Invia tutti i dati delle caselle una alla volta mediante l’emissione degli eventi socket.’tile’ e socket.’not_tile’. 

Invia nuovamente i dati della griglia emettendo l’evento socket.’map’ che passa al client negli attributi la larghezza, lunghezza e array delle caselle: tiles di MyGrid. 

Invia i dati dell’agente associato alla socket: me; che vengono trasmessi alla socket mediante l’emissione dell’evento socket.’you’ con attributo appunto me. Il client quindi aggiorna i dati del suo agente mediante il listener a socket.’you’.


### 3) COMUNICAZIONI Client-Server

tramite i vari eventi il client ed il server continuano a scambiarsi informazioni


## STRUTTURA
Per maggiori informazioni sulla strutturad del progetto e sui singoli file guardare il seguente pdf. 
[Struttura Deliveroo](/README-Image/Struttura%20Deliveroo.pdf)

