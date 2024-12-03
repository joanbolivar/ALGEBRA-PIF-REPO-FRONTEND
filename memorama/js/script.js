
class Memorama {

    
    

    constructor() {
      
        this.score = 100;
    
        this.canPlay = false;

        this.card1 = null;
        this.card2 = null;

        this.availableImages = [1,2,3,4,5,6];
        this.orderForThisRound = [];
        this.cards = Array.from( document.querySelectorAll(".board-game figure") );

        this.maxPairNumber = this.availableImages.length;
        this.startGame();
    
    }

    startGame() {
        
       
        this.score = 100;
        document.getElementById('score').textContent = `Score: ${this.score}`;
        this.foundPairs = 0;
        this.setNewOrder();
        this.setImagesInCards();
        this.openCards();

    }

    setNewOrder() {

        this.orderForThisRound = this.availableImages.concat(this.availableImages);
        this.orderForThisRound.sort( () => Math.random() - 0.5 );

    }

    setImagesInCards() {

        for (const key in this.cards) {
            
            const card = this.cards[key];
            const image = this.orderForThisRound[key];
            const imgLabel = card.children[1].children[0];

            card.dataset.image = image;
            
            imgLabel.src = `./images/se${image}.jpg`;
            
        }

    }

    openCards() {

        this.cards.forEach(card => card.classList.add("opened"));
        //cerrar las cartas despues de 8 segundos si se inicia un nuevo juego
        this.timer = setTimeout(this.closeCards.bind(this), 8000);
     
        document.getElementById('timer').textContent = this.counter();

    }

    closeCards() {

        this.cards.forEach(card => card.classList.remove("opened"));
        this.addClickEvents();
        this.canPlay = true;
        

    }

    counter() {
        let count = 8;
        const timer = setInterval(() => {
            count--;
            document.getElementById('timer').textContent = count;
            if (count === 0) {
                clearInterval(timer);
                document.getElementById('timer').textContent = '';
            }
        }, 1000);
    }

    addClickEvents() {

        this.cards.forEach(_this => _this.addEventListener("click", this.flipCard.bind(this)));

    }

    removeClickEvents() {

        this.cards.forEach(_this => _this.removeEventListener("click", this.flipCard));

    }


    flipCard(e) {
        const solutions = {
            '1': 'La aproximación más cercana a la raíz es x=1.4142; El método converge.',
            '2': 'La aproximación más cercana a la raíz es x=1.4315; El método converge.',
            '3': 'La aproximación más cercana a la raíz es x=1.8202; El método converge.',
            '4': 'La aproximación más cercana a la raíz es x=2.875; El método converge.',
            '5': 'La aproximación más cercana a la raíz es x=0.7260; El método converge.',
            '6': 'La aproximación más cercana a la raíz es x=3.0624; El método converge.'
            // Agrega aquí el resto de las imágenes y sus soluciones
        };

        const clickedCard = e.target;
    
        if (this.canPlay && !clickedCard.classList.contains("opened")) {
            clickedCard.classList.add("opened");
    
            if (!this.card1) this.card1 = clickedCard;
            else {
                this.card2 = clickedCard;

                console.log(typeof this.card1.dataset.image);

                if (this.card1.dataset.image == this.card2.dataset.image) {
                    const value = this.card1.dataset.image;
                    this.card2.addEventListener('transitionend', () => {
                    const solution = solutions[value];
                    alert(`¡Has encontrado un par! La solución es: ${solution}`);
                    }, { once: true });
    
                    this.card1 = null;
                    this.card2 = null;
                } else {
                    this.canPlay = false;
                    setTimeout(() => {
                        this.card1.classList.remove("opened");
                        this.card2.classList.remove("opened");
                        this.card1 = null;
                        this.card2 = null;
                        this.canPlay = true;
                        this.score -= 33;
                        document.getElementById('score').textContent = `Score: ${this.score}`;
                        if (this.score <= 1) {
                            setTimeout(() => {
                               alert('Has perdido el juego');
                                this.setNewGame();
                            }, 500); // Retrasa la alerta y el reinicio del juego en 500 milisegundos
                        }
                    }, 1000);
                }
            }
        }
    }
    checkPair(image) {

        if (!this.card1) this.card1 = image;
        else this.card2 = image;

        if (this.card1 && this.card2) {
            
            if (this.card1 == this.card2) {
                this.canPlay = false;
                setTimeout(this.checkIfWon.bind(this), 300)
                
            }
            else {

                this.canPlay = false;
                setTimeout(this.resetOpenedCards.bind(this), 800)

            }

        }

    }

    resetOpenedCards() {
        firstOpened.classList.remove("opened");
        secondOpened.classList.remove("opened");

        this.card1 = null;
        this.card2 = null;

        this.canPlay = true;

    }

    checkIfWon() {

        this.foundPairs++;

        this.card1 = null;
        this.card2 = null;
        this.canPlay = true;

        if (this.maxPairNumber == this.foundPairs) {

            alert("¡Ganaste!");
            this.setNewGame();
            
        }

    }

    setNewGame() {
        clearTimeout(this.timer); 
        this.removeClickEvents();
        this.cards.forEach(card => card.classList.remove("opened"));

        setTimeout(this.startGame.bind(this), 1000);

    }

}

document.addEventListener("DOMContentLoaded", () => {

    new Memorama();

});

document.getElementById('new-game').addEventListener('click', function() {
  // Reinicia el juego
  this.disabled = true;
    new Memorama();

    setTimeout(() => {
        this.disabled = false;
    }, 8000);
});