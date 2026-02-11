(function initChatbot() {
    function createChatbot() {
      if (document.getElementById('chatbot-toggle')) return;
  
      const toggle = document.createElement('button');
      toggle.id = 'chatbot-toggle';
      toggle.title = 'Abrir chat';
      toggle.className = 'scroll-toggle d-flex align-items-center justify-content-center';
      toggle.innerHTML = '<i class="bi bi-chat-dots"></i>';
      document.body.appendChild(toggle);
  
      const container = document.createElement('div');
      container.id = 'chatbot-container';
      container.innerHTML = `
        <iframe
          src="https://asistentepersonal-61724.chipp.ai"
          frameborder="0"
          title="Asistente personal"
          allow="clipboard-write"
        ></iframe>`;
      document.body.appendChild(container);
  
      toggle.addEventListener('click', () => {
        const visible = container.style.display === 'block';
        container.style.display = visible ? 'none' : 'block';
        toggle.title = visible ? 'Abrir chat' : 'Cerrar chat';
      });
  
      const onScroll = () => {
        if (window.scrollY > 100) {
          toggle.classList.add('active');
        } else {
          toggle.classList.remove('active');
        }
  
        if (window.scrollY <= 0) {
          container.style.display = 'none';
          toggle.title = 'Abrir chat';
        }
      };
  
      window.addEventListener('scroll', onScroll);
      onScroll();
    }
  
    // Ejecuta cuando DOM esté listo, y además chequea por si falla
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createChatbot);
    } else {
      createChatbot();
    }
  
    // Failsafe: reintenta cada 1s si no existe el botón
    let retry = 0;
    const maxRetries = 5;
    const interval = setInterval(() => {
      if (!document.getElementById('chatbot-toggle')) {
        createChatbot();
      }
      if (++retry >= maxRetries) clearInterval(interval);
    }, 1000);
  })();
  