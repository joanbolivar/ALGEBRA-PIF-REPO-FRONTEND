class MemoramaRegex {
    constructor(gameBoardElement, numTotalCards = 12) { // numTotalCards debe ser par
        this.gameBoard = gameBoardElement;
        this.scoreElement = document.getElementById('score');
           this.initialPreviewTimerDisplay = document.getElementById('initial-preview-timer');
        this.mainGameTimerDisplay = document.getElementById('main-game-timer');
        this.newGameButton = document.getElementById('new-game');

        this.numPairs = numTotalCards / 2;
        if (numTotalCards % 2 !== 0) {
            console.warn("El número total de cartas debe ser par. Ajustando al par más cercano.");
            this.numPairs = Math.floor(numTotalCards / 2);
        }
        this.numTotalCards = this.numPairs * 2;


        this.score = 100;
        this.canPlay = false;
        this.card1 = null;
        this.card2 = null;

        this.allGameData = []; // Almacenará {id, regex, string, explanation}
        this.cardsForThisRound = []; // Almacenará los objetos de carta para el tablero
        this.cardsElements = []; // Referencias a los elementos <figure> del DOM

        this.foundPairsCount = 0;
        this.initialDisplayTimeoutId = null;
        this.countdownIntervalId = null;
         this.initialDisplayDuration = 15000; // Duración inicial de la vista previa
        this.initialRevealOver = false; // Para saber si la revelación inicial ya pasó


         // Propiedades para el TEMPORIZADOR PRINCIPAL DEL JUEGO
        this.mainGameTimeLimit = 3 * 60; //3  minutos en segundos
        this.mainGameTimeRemaining = this.mainGameTimeLimit;
        this.mainGameTimerIntervalId = null;
        this.mainTimerFrozen = false;
        this.freezeTimerTimeoutId = null; // Para el timeout que descongela

         this.powers = [
            {
                name: "Extra Vistazo 👀",
                unlockThreshold: 1,
                description: "",
                unlocked: false,
                used: false,
                activate: () => this.activateExtraVistazo()
            },
            {
                name: "Bono de Tiempo ⏳",
                unlockThreshold: 3, // Se desbloquea al 3er par
                description: ``,
                unlocked: false,
                used: false,
                activate: () => this.activateCongelarTemporizadorPrincipal() // NUEVA FUNCIÓN

            },
            {
                name: "Pareja Destacada",
                unlockThreshold: 4, // Se desbloquea al 4to par
                description: "",
                unlocked: false,
                used: false,
                activate: () => this.activateParejaDestacada()
            }
        ];

        this.loadDataAndStart();
    }

     clearAllTimers() { // Método para limpiar todos los timers
        if (this.initialDisplayTimeoutId) clearTimeout(this.initialDisplayTimeoutId);
        if (this.countdownIntervalId) clearInterval(this.countdownIntervalId);
        if (this.mainGameTimerIntervalId) clearInterval(this.mainGameTimerIntervalId);
        if (this.freezeTimerTimeoutId) clearTimeout(this.freezeTimerTimeoutId);
        this.initialDisplayTimeoutId = null;
        this.countdownIntervalId = null;
        this.mainGameTimerIntervalId = null;
        this.freezeTimerTimeoutId = null;
    }

    async loadDataAndStart() {
        this.newGameButton.disabled = true;
         this.clearAllTimers(); // Limpiar timers antes de empezar
          this.powers.forEach(power => {
            power.unlocked = false;
            power.used = false;
        });
        
        try {
            const response = await fetch('./regex_data.txt');
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            const textData = await response.text();
            this.allGameData = textData.trim().split('\n').map((line, index) => {
                const parts = line.split(';');
                if (parts.length === 3) {
                    return {
                        id: `pair-${index}`,
                        regex: parts[0].trim(),
                        string: parts[1].trim(),
                        explanation: parts[2].trim()
                    };
                }
                return null;
            }).filter(item => item !== null);

            if (this.allGameData.length < this.numPairs) {
                Swal.fire({
                    icon: 'error',
                    title: 'Datos Insuficientes',
                    text: `Se necesitan al menos ${this.numPairs} pares en regex_data.txt. Actualmente hay ${this.allGameData.length}.`,
                });
                this.newGameButton.disabled = false;
                return;
            }
            this.startGame();
        } catch (error) {
            console.error("Error al cargar los datos del juego:", error);
            Swal.fire({
                icon: 'error',
                title: 'Error de Carga',
                text: 'No se pudieron cargar los datos para el juego. Revisa la consola.',
            });
            this.newGameButton.disabled = false;
        }

      
    }

    startGame() {
        this.clearAllTimers();
        this.score = 100;
        this.scoreElement.textContent = `Puntuación: ${this.score}`;
        this.foundPairsCount = 0;
        this.canPlay = false;
        this.card1 = null;
        this.card2 = null;
         this.initialRevealOver = false; // Resetear para el nuevo juego

        if (this.initialPreviewTimerDisplay) this.initialPreviewTimerDisplay.textContent = ''; // Limpiar display
   // Resetear temporizador principal
        this.mainGameTimeRemaining = this.mainGameTimeLimit;
        this.mainTimerFrozen = false;
        this.updateMainGameTimerDisplay(); // Mostrar tiempo inicial (07:00)

        this.powers.forEach(power => {
            power.unlocked = false;
            power.used = false;
        });
        this.updatePowersUI();

        this.prepareCardsForRound();
        this.shuffleCards();
        this.renderBoard();
        this.showCardsTemporarily(this.initialDisplayDuration);
        
    }

    prepareCardsForRound() {
        const shuffledData = [...this.allGameData].sort(() => 0.5 - Math.random());
        const selectedPairsData = shuffledData.slice(0, this.numPairs);

        this.cardsForThisRound = [];
        selectedPairsData.forEach(pair => {
            this.cardsForThisRound.push({
                uniqueId: `${pair.id}-regex`, // Para diferenciarla en el DOM si es necesario
                pairId: pair.id,
                type: 'regex',
                content: pair.regex,
                explanation: pair.explanation
            });
            this.cardsForThisRound.push({
                uniqueId: `${pair.id}-string`,
                pairId: pair.id,
                type: 'string',
                content: pair.string,
                explanation: pair.explanation // La explicación es la misma para el par
            });
        });
    }

    shuffleCards() {
        this.cardsForThisRound.sort(() => Math.random() - 0.5);
    }

    renderBoard() {
        this.gameBoard.innerHTML = ''; // Limpiar tablero anterior
        this.cardsElements = []; // Limpiar referencias a elementos DOM

        // Ajustar el número de columnas del grid dinámicamente
        const columns = Math.ceil(Math.sqrt(this.numTotalCards));
        this.gameBoard.style.gridTemplateColumns = `repeat(${columns > 3 ? columns : 4}, 1fr)`;


        this.cardsForThisRound.forEach(cardData => {
            const figure = document.createElement('figure');
            figure.dataset.pairId = cardData.pairId; // ID para identificar el par
            figure.dataset.uniqueId = cardData.uniqueId; // ID único de la carta
            // Guardamos el contenido y la explicación en el dataset para acceso fácil
            figure.dataset.content = cardData.content;
            figure.dataset.explanation = cardData.explanation;
            figure.dataset.type = cardData.type;


            const backDiv = document.createElement('div');
            backDiv.classList.add('back');
            backDiv.textContent = '❔'; // Puedes poner un icono o texto

            const frontDiv = document.createElement('div');
            frontDiv.classList.add('front');

            const contentSpan = document.createElement('span');
            contentSpan.classList.add('card-content');
            contentSpan.textContent = cardData.content;

            frontDiv.appendChild(contentSpan);
            figure.appendChild(backDiv);
            figure.appendChild(frontDiv);

            this.gameBoard.appendChild(figure);
            this.cardsElements.push(figure);
        });
    }

    showCardsTemporarily(duration) { // 8 segundos por defecto
          this.initialDisplayDuration = duration; // Actualizar por si cambia con el poder
        this.cardsElements.forEach(cardEl => cardEl.classList.add("opened"));
         this.startInitialPreviewCountdown(Math.ceil(duration / 1000)); // Nombre cambiado
        if (this.initialDisplayTimeoutId) clearTimeout(this.initialDisplayTimeoutId);


        this.initialDisplayTimeoutId = setTimeout(() => {
            this.hideCardsAndEnablePlay();
        }, duration);
    }

hideCardsAndEnablePlay() {
        this.cardsElements.forEach(cardEl => {
            if (!cardEl.classList.contains('matched')) {
                cardEl.classList.remove("opened");
            }
        });
        if (this.initialPreviewTimerDisplay) this.initialPreviewTimerDisplay.textContent = ''; // Limpiar contador de vista previa
        this.addClickEventsToCards();
        this.canPlay = true;
        this.initialRevealOver = true; // Marcar que la revelación inicial ha terminado
        this.newGameButton.disabled = false;

        this.startMainGameTimer(); // <-- INICIAR TEMPORIZADOR PRINCIPAL DEL JUEGO
    }
  startInitialPreviewCountdown(seconds) { // Nombre cambiado de startCountdown
        let count = seconds;
        if (this.countdownIntervalId) clearInterval(this.countdownIntervalId);

        if (this.initialPreviewTimerDisplay) this.initialPreviewTimerDisplay.textContent = ` ${count}s`;
        this.countdownIntervalId = setInterval(() => {
            count--;
            if (this.initialPreviewTimerDisplay) this.initialPreviewTimerDisplay.textContent = ` ${count}s`;
            if (count <= 0) {
                clearInterval(this.countdownIntervalId);
                if (this.initialPreviewTimerDisplay) this.initialPreviewTimerDisplay.textContent = '';
            }
        }, 1000);
    }

    addClickEventsToCards() {
        this.cardsElements.forEach(cardEl => {
            if (!cardEl.classList.contains('matched')) {
                // Remover listener antiguo antes de agregar uno nuevo para evitar duplicados
                cardEl.removeEventListener("click", this.handleCardFlipBound);
                this.handleCardFlipBound = this.handleCardFlip.bind(this); // Guardar referencia
                cardEl.addEventListener("click", this.handleCardFlipBound);
            }
        });
    }

    removeClickEventsFromAllCards() {
        this.cardsElements.forEach(cardEl => {
            cardEl.removeEventListener("click", this.handleCardFlipBound);
        });
    }

    handleCardFlip(event) {
        const clickedCard = event.currentTarget;

        if (!this.canPlay || clickedCard.classList.contains("opened") || clickedCard.classList.contains("matched")) {
            return;
        }

        clickedCard.classList.add("opened");

        if (!this.card1) {
            this.card1 = clickedCard;
        } else {
            this.card2 = clickedCard;
            // Evitar que la misma carta sea seleccionada dos veces
            if (this.card1.dataset.uniqueId === this.card2.dataset.uniqueId) {
                this.card2.classList.remove("opened"); // No la consideres abierta
                this.card2 = null; // Resetea card2
                return; // No hagas nada más
            }
            this.canPlay = false; // Deshabilitar más clics mientras se verifica el par

            this.checkForMatch();
        }
    }

    checkForMatch() {
        const id1 = this.card1.dataset.pairId;
        const id2 = this.card2.dataset.pairId;
        const explanation = this.card1.dataset.explanation; // Ambas cartas del par tienen la misma explicación

        // Contenido de las cartas para el mensaje
        const regexCardContent = (this.card1.dataset.type === 'regex' ? this.card1.dataset.content : this.card2.dataset.content);
        const stringCardContent = (this.card1.dataset.type === 'string' ? this.card1.dataset.content : this.card2.dataset.content);

        if (id1 === id2) { // ¡Es un par!
            this.foundPairsCount++;
            this.card1.classList.add("matched");
            this.card2.classList.add("matched");

             // *** Aquí está el cambio: ***
 const backDiv1 = this.card1.querySelector('.back');
 const backDiv2 = this.card2.querySelector('.back');
 backDiv1.textContent = '🤩'; // ¡Nuevo emoji!
 backDiv2.textContent = '🤩'; // ¡Nuevo emoji!

            // Remover listeners de las cartas emparejadas
            this.card1.removeEventListener("click", this.handleCardFlipBound);
            this.card2.removeEventListener("click", this.handleCardFlipBound);

            this.checkAndUnlockPowers(); // <-- Comprobar y desbloquear poderes
            this.updatePowersUI();      // <-- Actualizar UI de poderes

            setTimeout(() => {
                Swal.fire({
                    icon: 'success',
                    title: '¡Par Correcto!',
                    html: `<b>Expresión Regular:</b> <code>${regexCardContent}</code><br>
                           <b>Cadena Válida:</b> <code>${stringCardContent}</code><br><br>
                           <b>Explicación:</b><br>${explanation}`,
                    confirmButtonText: '¡Genial!'
                });
                this.resetSelectedCards();
                if (this.foundPairsCount === this.numPairs) {
                    this.gameOver(true);
                } else {
                    this.canPlay = true; // Permitir seguir jugando
                }
            }, 750); // Pequeña demora para ver el efecto y el SweetAlert
        } else { // No es un par

            this.score -= 15; // Penalización
            if (this.score < 0) this.score = 0;
            this.scoreElement.textContent = `Puntuación: ${this.score}`;

            setTimeout(() => {
                Swal.fire({
                    icon: 'error',
                    title: '¡Incorrecto!',
                    html: `La cadena <code>${this.card1.dataset.type === 'string' ? this.card1.dataset.content : this.card2.dataset.content}</code> no es el par de la expresión <code>${this.card1.dataset.type === 'regex' ? this.card1.dataset.content : this.card2.dataset.content}</code>.<br><br><b>Explicación de la expresión que volteaste:</b><br>${this.card1.dataset.type === 'regex' ? this.card1.dataset.explanation : this.card2.dataset.explanation}`,
                    confirmButtonText: 'Intentar de nuevo'
                });
                this.card1.classList.remove("opened");
                this.card2.classList.remove("opened");
                this.resetSelectedCards();

                if (this.score <= 0) {
                            console.log("[ScoreDebug] Puntuación llegó a cero o menos (" + this.score + "). Llamando a gameOver(false).");

                    this.gameOver(false);
                } else {
                    this.canPlay = true; // Permitir seguir jugando
                }
            }, 1200); // Demora para que el jugador vea ambas cartas
        }
    }

    checkAndUnlockPowers() {
        this.powers.forEach(power => {
            if (!power.unlocked && this.foundPairsCount >= power.unlockThreshold) {
                power.unlocked = true;
                Swal.fire({
                    icon: 'star',
                    title: '¡Poder Desbloqueado!',
                    html: `Has desbloqueado: <b>${power.name}</b><br><small>${power.description}</small>`,
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 4000,
                    timerProgressBar: true
                });
            }
        });
    }

     /*updatePowersUI() {
        const powersDisplay = document.getElementById('powers-display');
        if (!powersDisplay) return;
        powersDisplay.innerHTML = '';

        this.powers.forEach(power => {
            const powerItemDiv = document.createElement('div');
            powerItemDiv.classList.add('power-item');

            let contentHtml = `<strong>${power.name}</strong><br><small>${power.description}</small><br>`;

            if (!power.unlocked) {
                powerItemDiv.classList.add('locked');
                contentHtml += `<span>(Se desbloquea con ${power.unlockThreshold} pares)</span>`;
            } else if (power.used) {
                powerItemDiv.classList.add('used');
                contentHtml += `<span>(Poder Usado)</span>`;
            } else {
                const button = document.createElement('button');
                button.textContent = `Activar ${power.name}`;
                button.onclick = () => {
                    if (this.card1 && (power.name === "Extra Vistazo" || power.name === "Pareja Destacada")) {
                        Swal.fire('Acción no permitida', 'Termina de seleccionar tu par actual antes de usar este poder.', 'warning');
                        return;
                    }
                    power.activate();
                    power.used = true;
                    button.disabled = true; // Deshabilitar botón visualmente
                    this.updatePowersUI(); // Re-render para mostrar como usado
                };
                powerItemDiv.appendChild(document.createElement('p').appendChild(button)); // Envuelve el botón en un <p> o similar si es necesario
            }
            powerItemDiv.insertAdjacentHTML('afterbegin', contentHtml); // Añade el texto antes del botón si existe
            powersDisplay.appendChild(powerItemDiv);
        });
    }*/

        updatePowersUI() {
    const powersDisplay = document.getElementById('powers-display');
    if (!powersDisplay) return;
    powersDisplay.innerHTML = ''; // Limpiar vista previa

    this.powers.forEach(power => {
        const powerItemDiv = document.createElement('div');
        powerItemDiv.classList.add('power-item');
        // Clase específica para cada poder basada en su nombre
        const powerIdClass = 'power-' + power.name.toLowerCase().replace(/\s+/g, '-');
        powerItemDiv.classList.add(powerIdClass);

        let iconChar = '';
        let powerColorVar = '--power-default-color'; // Variable CSS para el color del poder

        if (power.name === "Extra Vistazo") {
            iconChar = '👁️';
            powerColorVar = '--power-vistazo-color';
        } else if (power.name === "Bono de Tiempo") { // Antes Congelar Temporizador
            iconChar = '⏱️';
            powerColorVar = '--power-tiempo-color';
        } else if (power.name === "Pareja Destacada") {
            iconChar = '⭐';
            powerColorVar = '--power-destacada-color';
        }
        powerItemDiv.style.setProperty('--power-theme-color', `var(${powerColorVar})`);


        const contentDiv = document.createElement('div');
        contentDiv.classList.add('power-content');

        const iconSpan = document.createElement('span');
        iconSpan.classList.add('power-icon');
        iconSpan.textContent = iconChar;

        const nameH3 = document.createElement('h3');
        nameH3.classList.add('power-name');
        nameH3.textContent = power.name;

        const descriptionP = document.createElement('p');
        descriptionP.classList.add('power-description');
        descriptionP.textContent = power.description;

        contentDiv.appendChild(iconSpan);
        contentDiv.appendChild(nameH3);
        contentDiv.appendChild(descriptionP);
        powerItemDiv.appendChild(contentDiv);

        const CtaDiv = document.createElement('div'); // Div para Call To Action (botón o estado)
        CtaDiv.classList.add('power-cta');

        if (!power.unlocked) {
            powerItemDiv.classList.add('locked');
            const statusP = document.createElement('p');
            statusP.classList.add('power-status', 'status-locked');
            statusP.innerHTML = `<span class="lock-icon">🔒</span> Bloqueado <small>(Necesitas ${power.unlockThreshold} pares)</small>`;
            CtaDiv.appendChild(statusP);
        } else if (power.used) {
            powerItemDiv.classList.add('used');
            const statusP = document.createElement('p');
            statusP.classList.add('power-status', 'status-used');
            statusP.textContent = `✔️ Poder Usado`;
            CtaDiv.appendChild(statusP);
        } else { // Desbloqueado y no usado
            powerItemDiv.classList.add('available');
            const button = document.createElement('button');
            button.classList.add('power-activate-btn');
            button.innerHTML = `<span class="btn-icon">${iconChar}</span> Activar`;
            button.onclick = () => {
                let canActivate = true;
                if (this.card1 && (power.name === "Extra Vistazo" || power.name === "Pareja Destacada")) {
                    Swal.fire('Acción no permitida', 'Termina de seleccionar tu par actual antes de usar este poder.', 'warning');
                    canActivate = false; // No marcar como usado si no se puede activar
                }

                if (canActivate) {
                    const activationSuccessful = power.activate(); // Asumimos que activate() puede devolver false si falla
                    if (activationSuccessful !== false) { // Si no devuelve explícitamente false, se considera usado
                        power.used = true;
                    } else {
                        // Si activate() devolvió false, no se marcó como usado.
                        // Esto requiere que tus funciones activate() devuelvan false si fallan por una condición interna.
                    }
                }
                this.updatePowersUI(); // Siempre actualizar UI para reflejar el estado
            };
            CtaDiv.appendChild(button);
        }
        powerItemDiv.appendChild(CtaDiv);
        powersDisplay.appendChild(powerItemDiv);
    });
}

    resetSelectedCards() {
        this.card1 = null;
        this.card2 = null;
    }

    gameOver(playerWon) {
        this.canPlay = false;
         this.clearAllTimers();
        this.removeClickEventsFromAllCards(); // Quitar todos los listeners
        clearTimeout(this.initialDisplayTimeoutId);
        clearInterval(this.countdownIntervalId);
       // this.timerElement.textContent = '';
        this.newGameButton.disabled = false; // Habilitar botón de nuevo juego

        let title, text, icon;
        if (playerWon) {
            title = '🎉 ¡Felicidades, Ganaste! 🎉';
            text = `Completaste todos los pares. Tu puntuación final es: ${this.score}.`;
            icon = 'success';
        } else {
            title = '😭 ¡Juego Terminado! 😭';
            text = 'Te has quedado sin puntos. ¡Sigue practicando!';
            icon = 'error';
        }

        Swal.fire({
            title: title,
            text: text,
            icon: icon,
            confirmButtonText: 'Aceptar',
            allowOutsideClick: false,
            allowEscapeKey: false,
        }).then((result) => {
            if (result.isConfirmed) {
                // El botón ya está habilitado, el usuario puede hacer clic o se puede iniciar automáticamente
                // this.loadDataAndStart(); // Opcional: reiniciar automáticamente
            }
        });
    }

    // --- MÉTODOS DEL TEMPORIZADOR PRINCIPAL ---
    startMainGameTimer() {
        if (this.mainGameTimerIntervalId) clearInterval(this.mainGameTimerIntervalId);
        // No resetear mainGameTimeRemaining aquí si la idea es reanudarlo (ej. después de un freeze)
        // Solo se resetea en startGame()
        this.updateMainGameTimerDisplay();

        this.mainGameTimerIntervalId = setInterval(() => {
            if (!this.mainTimerFrozen && this.mainGameTimeRemaining > 0) {
                this.mainGameTimeRemaining--;
                this.updateMainGameTimerDisplay();

                if (this.mainGameTimeRemaining <= 0) {
                    this.clearAllTimers();
                    Swal.fire({
                        icon: 'warning',
                        title: '¡Tiempo Agotado!',
                        text: 'Se acabó el tiempo. Has perdido.',
                        confirmButtonText: 'Ver Tablero',
                        allowOutsideClick: false,
                        allowEscapeKey: false,
                    }).then(() => {
                        this.gameOver(false); // Player loses
                    });
                }
            }
        }, 1000);
    }

     updateMainGameTimerDisplay() {
        if (!this.mainGameTimerDisplay) return;
        const minutes = Math.floor(this.mainGameTimeRemaining / 60);
        const seconds = this.mainGameTimeRemaining % 60;
        this.mainGameTimerDisplay.textContent = `Tiempo: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        if (this.mainTimerFrozen) {
            this.mainGameTimerDisplay.textContent += " (Congelado)";
            this.mainGameTimerDisplay.classList.add('frozen');
        } else {
            this.mainGameTimerDisplay.classList.remove('frozen');
        }
    }
   

     activateExtraVistazo() {
        if (!this.canPlay && !this.initialRevealOver) { // Si aún está en la revelación inicial
             Swal.fire('Espera un poco', 'Este poder es más útil cuando las cartas ya están ocultas.', 'info');
             const power = this.powers.find(p => p.name === "Extra Vistazo");
             if(power) power.used = false; // Permitir re-uso si falló por timing
             this.updatePowersUI();
             return;
        }

        this.canPlay = false;
        const unrevealedCards = this.cardsElements.filter(card =>
            !card.classList.contains('opened') && !card.classList.contains('matched')
        );

        if (unrevealedCards.length === 0) {
            Swal.fire('Nada que mostrar', 'Todas las cartas ya están reveladas o emparejadas.', 'info');
            this.canPlay = true;
            const power = this.powers.find(p => p.name === "Extra Vistazo");
            if(power) power.used = false;
            this.updatePowersUI();
            return;
        }

        Swal.fire({

        /*
             icon: 'star',
                    title: '¡Poder Desbloqueado!',
                    html: `Has desbloqueado: <b>${power.name}</b><br><small>${power.description}</small>`,
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 4000,
                    timerProgressBar: true
        */






            title: '¡Extra Vistazo Activado!',
            text: 'Memoriza rápido...',
            toast: true,
            position: 'top-end',
            timer: 5000,
            showConfirmButton: false,
           timerProgressBar: true,
            didOpen: () => {
                unrevealedCards.forEach(card => card.classList.add('opened'));
            }
        }).then(() => { // Se ejecuta después de que el timer del Swal termina
            unrevealedCards.forEach(card => card.classList.remove('opened'));
            this.canPlay = true;
            // Si card1 estaba seleccionado antes del vistazo, podría necesitar lógica adicional para reabrirlo.
            // Por simplicidad, asumimos que el jugador no tiene una carta seleccionada al activar.
            if (this.card1 && !this.card1.classList.contains('matched') && !this.card1.classList.contains('opened')) {
                this.card1.classList.add('opened'); // Reabrir si estaba seleccionada
            }
        });
    }

 // --- MODIFICACIÓN DEL PODER BONO DE TIEMPO ---
    activateCongelarTemporizadorPrincipal() { // Nueva función para el poder
        if (!this.initialRevealOver) {
            Swal.fire('Espera un Poco', 'El juego principal aún no ha comenzado.', 'info');
            const power = this.powers.find(p => p.name === "Bono de Tiempo");
            if (power) power.used = false; // No se usó efectivamente
            this.updatePowersUI();
            return;
        }
        if (this.mainTimerFrozen) {
            Swal.fire('Ya Congelado', 'El temporizador ya está congelado.', 'info');
            const power = this.powers.find(p => p.name === "Bono de Tiempo");
            if (power) power.used = false;
            this.updatePowersUI();
            return;
        }
        if (this.mainGameTimeRemaining <= 0) {
            Swal.fire('Juego Terminado', 'El tiempo ya se agotó.', 'info');
            const power = this.powers.find(p => p.name === "Bono de Tiempo");
            if (power) power.used = false;
            this.updatePowersUI();
            return;
        }

        this.mainTimerFrozen = true;
        const freezeDurationSeconds = 2 * 60; // 2 minutos
        this.updateMainGameTimerDisplay(); // Actualiza para mostrar "(Congelado)"
        Swal.fire({
            icon: 'info',
            title: '¡Tiempo Congelado!',
            text: `El temporizador principal se ha detenido por ${freezeDurationSeconds / 60} minutos.`,
            toast: true,
            position: 'top-center',
            timer: 3000,
            showConfirmButton: false
        });

        if (this.freezeTimerTimeoutId) clearTimeout(this.freezeTimerTimeoutId); // Limpiar anterior si existiera
        this.freezeTimerTimeoutId = setTimeout(() => {
            this.mainTimerFrozen = false;
            this.updateMainGameTimerDisplay(); // Quita "(Congelado)"
            Swal.fire({
                icon: 'info',
                title: '¡Tiempo Reanudado!',
                text: 'El temporizador principal vuelve a correr.',
                toast: true,
                position: 'top-center',
                timer: 3000,
                showConfirmButton: false
            });
            // No es necesario reiniciar el mainGameTimerIntervalId aquí, ya que solo se pausó la resta de tiempo.
        }, freezeDurationSeconds * 1000);
    }

    activateParejaDestacada() {
        this.canPlay = false; // Evitar interacciones mientras se procesa
        const unrevealedFaceDownCards = this.cardsElements.filter(card =>
            !card.classList.contains('opened') && !card.classList.contains('matched')
        );

        if (unrevealedFaceDownCards.length === 0) {
            Swal.fire('Nada que destacar', 'No hay cartas ocultas disponibles.', 'info');
            this.canPlay = true;
            const power = this.powers.find(p => p.name === "Pareja Destacada");
            if(power) power.used = false;
            this.updatePowersUI();
            return;
        }

        const randomIndex = Math.floor(Math.random() * unrevealedFaceDownCards.length);
        const cardToReveal = unrevealedFaceDownCards[randomIndex];

        cardToReveal.classList.add('opened'); // Voltear la carta
        // No la marcamos como 'matched' ni la asignamos a this.card1/2 inmediatamente
        // Es una revelación permanente, el jugador la usará en su turno.
        // Si ya estaba this.card1 seleccionada, esta carta podría ser this.card2
        
        Swal.fire('¡Carta Destacada!', `Se ha revelado una carta para ayudarte.`, 'success');
        
        // Si el jugador ya tenía una carta seleccionada (this.card1),
        // y la carta revelada es su pareja, entonces es un match.
        if (this.card1 && this.card1 !== cardToReveal && this.card1.dataset.pairId === cardToReveal.dataset.pairId) {
            this.card2 = cardToReveal;
            // Retrasar un poco para que el jugador vea la carta destacada antes del match.
            setTimeout(() => {
                 this.checkForMatch();
            }, 800);
        } else if (this.card1 && this.card1 !== cardToReveal) {
            // Si tenía una carta1 y la destacada no es su par, la destacada se queda abierta,
            // el jugador sigue con su card1 y puede elegir la destacada u otra.
            this.canPlay = true;
        }
         else { // Si no había card1, o card1 es la misma que la revelada
            this.card1 = cardToReveal; // La carta destacada se convierte en la primera selección.
            this.canPlay = true; // Permitir al jugador buscar la pareja.
        }
    }



     // Método para manejar el reinicio desde el botón
    requestNewGame() {
                this.clearAllTimers(); // Limpiar timers al solicitar nuevo juego
if (this.mainGameTimerDisplay) this.mainGameTimerDisplay.textContent = `Tiempo: ${Math.floor(this.mainGameTimeLimit / 60).toString().padStart(2, '0')}:00`; // Reset visual
        if (this.initialPreviewTimerDisplay) this.initialPreviewTimerDisplay.textContent = '';

        if (this.initialDisplayTimeoutId) clearTimeout(this.initialDisplayTimeoutId);
        if (this.countdownIntervalId) clearInterval(this.countdownIntervalId);
        this.removeClickEventsFromAllCards();
        this.gameBoard.innerHTML = '<p style="text-align:center; width:100%;">Cargando nuevo juego...</p>';
        //this.timerElement.textContent = '';
        this.loadDataAndStart();
        this.updatePowersUI();
    }

}
// Al final del archivo, donde configuras el juego:
document.addEventListener("DOMContentLoaded", () => {
    const gameBoardElement = document.querySelector(".board-game");
    let currentGame = new MemoramaRegex(gameBoardElement, 12);

    const newGameButton = document.getElementById('new-game');
    newGameButton.addEventListener('click', () => {
        // Si currentGame existe y tiene un método para limpiar timers, llámalo.
        if (currentGame && typeof currentGame.clearTimers === 'function') { // Necesitarías un método clearTimers
            currentGame.clearTimers();
        }
        currentGame.requestNewGame();
    });
});