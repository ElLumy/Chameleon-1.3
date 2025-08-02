// content/injector.js
// Este script se ejecuta en el contexto ISOLATED y actúa como puente
(async function() {
  'use strict';
  
  console.log('[Chameleon Injector] Initializing...');
  
  // Cargar datos de perfiles
  async function loadProfilesData() {
    try {
      const response = await fetch(chrome.runtime.getURL('data/profiles.json'));
      if (!response.ok) {
        throw new Error('Failed to load profiles data');
      }
      return await response.json();
    } catch (error) {
      console.error('[Chameleon Injector] Failed to load profiles data:', error);
      return null;
    }
  }
  
  // Obtener semilla de sesión
  async function getSessionSeed() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getSessionSeed' });
      if (response && response.seed) {
        return response.seed;
      }
    } catch (error) {
      console.error('[Chameleon Injector] Error getting seed:', error);
    }
    return null;
  }
  
  // Escuchar mensajes del script principal
  window.addEventListener('message', async (event) => {
    if (event.data && event.data.type === 'CHAMELEON_REQUEST') {
      console.log('[Chameleon Injector] Received request:', event.data.action);
      
      let response = null;
      
      try {
        switch (event.data.action) {
          case 'getSessionSeed':
            const seedResponse = await chrome.runtime.sendMessage({ action: 'getSessionSeed' });
            response = {
              type: 'CHAMELEON_RESPONSE',
              action: 'getSessionSeed',
              data: seedResponse
            };
            break;
            
          case 'saveProfile':
            await chrome.storage.session.set({ 
              profile: event.data.profile,
              timestamp: Date.now()
            });
            
            console.log('[Chameleon Injector] Profile saved to storage');
            
            response = {
              type: 'CHAMELEON_RESPONSE',
              action: 'saveProfile',
              data: { success: true }
            };
            break;
            
          case 'getSessionInfo':
            const info = await chrome.runtime.sendMessage({ action: 'getSessionInfo' });
            response = {
              type: 'CHAMELEON_RESPONSE',
              action: 'getSessionInfo',
              data: info
            };
            break;
        }
      } catch (error) {
        console.error('[Chameleon Injector] Error handling request:', error);
        response = {
          type: 'CHAMELEON_RESPONSE',
          action: event.data.action,
          data: { error: error.message }
        };
      }
      
      if (response) {
        window.postMessage(response, '*');
      }
    }
  });
  
  // Inyectar script con datos iniciales
  async function injectMainScript() {
    try {
      // Cargar datos necesarios
      const [profilesData, sessionSeed] = await Promise.all([
        loadProfilesData(),
        getSessionSeed()
      ]);
      
      if (!profilesData) {
        throw new Error('Failed to load profiles data');
      }
      
      if (!sessionSeed) {
        throw new Error('Failed to get session seed');
      }
      
      // Inyectar datos en la página
      const script = document.createElement('script');
      script.textContent = `
        window.__chameleonInitData = {
          profilesData: ${JSON.stringify(profilesData)},
          sessionSeed: ${JSON.stringify(sessionSeed)}
        };
        console.log('[Chameleon] Initial data injected');
      `;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
      
    } catch (error) {
      console.error('[Chameleon Injector] Failed to inject initial data:', error);
    }
  }
  
  // Inyectar el script principal y los módulos
  function injectScript(file) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL(file);
      script.onload = function() {
        this.remove();
        resolve();
      };
      script.onerror = function() {
        console.error('[Chameleon Injector] Failed to load:', file);
        reject(new Error(`Failed to load ${file}`));
      };
      (document.head || document.documentElement).appendChild(script);
    });
  }
  
  // Inyectar en orden
  const scriptsToInject = [
    'lib/seedrandom.min.js',
    'content/modules/utils/jitter.js',
    'content/modules/interceptors/meta-proxy.js',
    'content/modules/interceptors/navigator.js',
    'content/modules/interceptors/screen.js',
    'content/modules/interceptors/canvas.js',
    'content/modules/interceptors/webgl.js',
    'content/modules/interceptors/audio.js',
    'content/modules/interceptors/timezone.js',
    'content/chameleon-main.js'
  ];
  
  // Inyectar secuencialmente
  async function injectAll() {
    // Primero inyectar los datos iniciales
    await injectMainScript();
    
    // Luego inyectar los scripts
    for (const script of scriptsToInject) {
      try {
        await injectScript(script);
        console.log('[Chameleon Injector] Injected:', script);
      } catch (error) {
        console.error('[Chameleon Injector] Failed to inject:', script, error);
      }
    }
  }
  
  // Iniciar inyección
  await injectAll();
  
  console.log('[Chameleon Injector] All scripts injected');
  
})();