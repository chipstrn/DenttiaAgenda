export const CLINIC_INFO = {
  name: "Denttia Servicios Dentales y Ortodoncia",
  locations: {
    tehuacan: {
      id: 'tehuacan',
      name: "Sede Tehuacán",
      address: "Plaza Galerias, Calz. Adolfo López Mateos 2811-Local 3, Zona Alta, 75760 Tehuacán, Pue.",
      phones: {
        whatsapp: "5212381106200", 
        fixed: "238 392 9829"
      }
    },
    huautla: {
      id: 'huautla',
      name: "Sede Huautla",
      address: "Dirección de Huautla...", 
      phones: {
        whatsapp: "5212381106200", 
        fixed: ""
      }
    }
  },
  schedules: {
    weekdays: "10:00 a.m. – 2:00 p.m., 4:00 – 8:00 p.m.",
    saturday: "10:00 a.m. – 2:00 p.m., 4:00 – 8:00 p.m.",
    sunday: "Cerrado"
  }
};

// ESTA ES LA FUNCIÓN QUE FALTABA:
export const getWhatsAppLink = (phone: string, message: string) => {
  // Limpia el teléfono quitando espacios, guiones y paréntesis
  const cleanPhone = phone.replace(/\D/g, ''); 
  const encodedMessage = encodeURIComponent(message);
  
  // Si el número no trae código de país (ej. 52), se lo agregamos por seguridad
  const finalPhone = cleanPhone.length === 10 ? `521${cleanPhone}` : cleanPhone;
  
  return `https://wa.me/${finalPhone}?text=${encodedMessage}`;
};