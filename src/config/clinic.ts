// Configuración centralizada de la clínica KlinikOS

// Nombre del sistema SaaS
export const SYSTEM_NAME = 'KlinikOS';

export const CLINIC_CONFIG = {
  name: 'KlinikOS',
  shortName: 'KlinikOS',

  // Contacto oficial
  whatsapp: '5212381106200', // Formato internacional para wa.me
  whatsappDisplay: '238 110 6200',
  phone: '238 392 9829',

  // Sedes
  locations: {
    tehuacan: {
      id: 'tehuacan',
      name: 'Tehuacán',
      address: 'Plaza Galerias, Calz. Adolfo López Mateos 2811-Local 3, Zona Alta, 75760 Tehuacán, Pue.',
      shortAddress: 'Plaza Galerias, Local 3, Tehuacán',
    },
    huautla: {
      id: 'huautla',
      name: 'Huautla',
      address: 'Huautla de Jiménez, Oaxaca',
      shortAddress: 'Huautla de Jiménez',
    }
  },

  // Horarios
  schedule: {
    weekdays: {
      morning: { start: '10:00', end: '14:00' },
      afternoon: { start: '16:00', end: '20:00' }
    },
    saturday: {
      morning: { start: '10:00', end: '14:00' },
      afternoon: { start: '16:00', end: '20:00' }
    },
    sunday: null // Cerrado
  },

  scheduleText: {
    weekdays: 'Lunes a Viernes: 10:00 a.m. – 2:00 p.m. y 4:00 – 8:00 p.m.',
    saturday: 'Sábado: 10:00 a.m. – 2:00 p.m. y 4:00 – 8:00 p.m.',
    sunday: 'Domingo: Cerrado'
  }
};

// Helper para generar link de WhatsApp
export const generateWhatsAppLink = (message: string, phoneNumber?: string) => {
  const phone = phoneNumber || CLINIC_CONFIG.whatsapp;
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${phone}?text=${encodedMessage}`;
};

// Helper para generar mensaje de recordatorio de cita
export const generateAppointmentReminder = (
  patientName: string,
  date: string,
  time: string,
  doctorName: string,
  treatment: string
) => {
  return `¡Hola ${patientName}! 👋

Te recordamos tu cita en *${CLINIC_CONFIG.name}*:

📅 *Fecha:* ${date}
🕐 *Hora:* ${time}
👨‍⚕️ *Doctor:* ${doctorName}
🦷 *Tratamiento:* ${treatment}

📍 ${CLINIC_CONFIG.locations.tehuacan.shortAddress}

Por favor confirma tu asistencia respondiendo a este mensaje.

¡Te esperamos! 😊`;
};