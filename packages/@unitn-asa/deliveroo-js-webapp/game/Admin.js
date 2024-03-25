let params = new URLSearchParams(window.location.search);

console.log(params)
if (!params.has('match')) {
    params.append('match', '0');
}
console.log(params)

let matchId = params.get("match");
checkLogged()

function checkLogged(){
    let cookie = getAdminCookie()
    if(cookie !== 'false'){
        
        // change the login button to logged status
        let loggedButton = document.getElementById('loginButton');
        loggedButton.classList.add('logged');
        loggedButton.innerText = 'Logged'

        // add the delete and play/stop buotton to menage the match
        let divButtons = document.createElement('div'); 
        divButtons.id ='div-buttons'

        // request the status of the match to the server
        fetch(`/api/matches/${matchId}/status`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
        })
        .then(response => {
            if (response.ok) { return response.json(); 
            } else { throw new Error('Error during data sending'); }
        })
        .then(data => {
            console.log('Correct: ', data.status)

            let deleteButton = document.createElement('button');
            deleteButton.classList.add('delete-button');
            deleteButton.setAttribute('match', matchId);
            deleteButton.textContent = `X`;
            deleteButton.addEventListener('click',deleteMatch)
                    
            let playButton = document.createElement('button');
            playButton.classList.add('play-stop-button');
            playButton.setAttribute('match', matchId);
            playButton.textContent = invertPlayStop(data.status);
            playButton.addEventListener('click',sendPlayStopMatch)

            divButtons.appendChild(deleteButton);
            divButtons.appendChild(playButton);
            
            let divAdmin = document.getElementById('admin-div');
            divAdmin.appendChild(divButtons)
        })
        .catch(error => {
            console.error('An error occurred:', error.message);
        });

        
    }else{

        // change the login button to login status
        let loggedButton = document.getElementById('loginButton');
        loggedButton.classList.remove('logged');
        loggedButton.innerText = 'Login'

        let divAdmin = document.getElementById('admin-div');
        let divButtons  = document.getElementById('div-buttons')
        if(divAdmin && divButtons){divAdmin.removeChild(divButtons) }
        
    }
}

// open the login form at the press of the login button
document.getElementById('home-button').addEventListener('click', function() {
    var url = '/home';
    window.location.href = url; 
});

// open the login form at the press of the login button
document.getElementById('loginButton').addEventListener('click', function() {
    
    let loggedButton = document.getElementById('loginButton');
    if(loggedButton.classList.contains('logged')){ deleteAdminCookie(); console.log('LOGOUT ADMIN SUCSESS'); return; }
    openORcloseLoginForm(); 
});

// close the login form whem the user click the x 
document.querySelector('#loginHeader button.close-button').addEventListener('click', function() {
    openORcloseLoginForm(); 
});

document.getElementById('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = document.getElementById('username-login').value;
    const password = document.getElementById('password-login').value;

    const response = await fetch('/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (data.success) {
        console.log("LOGIN ADMIN SUCSESS")
        setAdminCookie(data.token)
        openORcloseLoginForm(); 
        checkLogged();
    } else {
        console.log("LOGIN ADMIN ERROR")
        document.getElementById('username-login').classList.add('error');
        document.getElementById('password-login').classList.add('error');
    }
});


function openORcloseLoginForm(){
    let loginFormContainer = document.getElementById('loginFormContainer');
    let overlay = document.getElementById('overlay');
    if (loginFormContainer.style.display === 'none' || loginFormContainer.style.display === '') {
        loginFormContainer.style.display = 'block';
        overlay.style.display = 'block';
    } else {
        loginFormContainer.style.display = 'none';
        overlay.style.display = 'none';
    }
}


// Function to menage the cookie
function setAdminCookie(token) {
    const d = new Date();
    d.setTime(d.getTime() + (1 * 24 * 60 * 60 * 1000));
    let expires = "expires="+d.toUTCString();
    document.cookie = "admin_token" + "=" + token + ";" + expires + ";path=/";
}

function getAdminCookie() {
    let name = "admin_token="
    let ca = document.cookie.split(';');
    for(let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "false";
}

function deleteAdminCookie() {
    document.cookie = 'admin_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    checkLogged();
}


function sendPlayStopMatch(event){
    
    const token_admin = getAdminCookie();
    const matchId = event.target.getAttribute('match');
    //console.log(event)
    //console.log('Cange staus match ', matchId + ' to ', event.currentTarget.textContent);

    fetch(`/api/matches/${matchId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `${token_admin}`
        },
        body: JSON.stringify({ id: matchId}) // Invia l'ID del match e il nuovo stato
      })
      .then(response => {
        if (response.ok) {
          return response.json(); 
        } else {
          throw new Error('Error during data sending');
        }
      })
      .then(data => {
        console.log('Correct: ', data.message)
        // Update the botton
        event.target.textContent = invertPlayStop(event.target.textContent)
      })
      .catch(error => {
        console.error('An error occurred:', error.message);
      });
    
}

function invertPlayStop(status){
    if(status == 'stop') return 'play';
    if(status == 'play') return 'stop';
}


function deleteMatch(event){

    const token_admin = getAdminCookie();
    const matchId = event.target.getAttribute('match');

    fetch(`/api/matches/${matchId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `${token_admin}`
        },
    })
    .then(response => {
        if (response.ok) {
            return response.json(); 
        } else {
            throw new Error('Error during data sending', response.json().message);
        }
    })
    .then(data => {
        console.log('Correct: ', data.message)
    })
    .catch(error => {
        console.error('An error occurred:', error.message);
    });
    
}
