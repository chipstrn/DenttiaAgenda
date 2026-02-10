"use client";

import React, { useEffect } from 'react';
import { driver } from 'driver.js';
import "driver.js/dist/driver.css";
import { useLocation } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';

export const TourGuide = () => {
    const location = useLocation();

    const startAgendaTour = () => {
        const agendaDriver = driver({
            showProgress: true,
            steps: [
                { popover: { title: 'Bienvenido a KlinikOS', description: 'Te daremos un recorrido rápido por las funciones principales.' } },
                { element: '.agenda-view', popover: { title: 'Tu Agenda', description: 'Aquí verás todas tus citas organizadas por día, semana o mes.' } },
                { element: '.new-appointment-btn', popover: { title: 'Nueva Cita', description: 'Haz clic aquí para agendar una nueva cita rápidamente.' } },
                { element: '.calendar-nav', popover: { title: 'Navegación', description: 'Cambia de fecha fácilmente usando este calendario.' } },
            ]
        });
        agendaDriver.drive();
    };

    const startPatientTour = () => {
        const patientDriver = driver({
            showProgress: true,
            steps: [
                { popover: { title: 'Expediente del Paciente', description: 'Aquí gestionas toda la información clínica.' } },
                { element: '.patient-tabs', popover: { title: 'Secciones', description: 'Navega entre Datos Personales, Odontograma, Tratamientos y Pagos.' } },
                { element: '.odontogram-view', popover: { title: 'Odontograma', description: 'Registra el estado actual y tratamientos visualmente.' } },
            ]
        });
        patientDriver.drive();
    };

    // Auto-start logic could go here, checking localStorage or DB
    useEffect(() => {
        const seenTour = localStorage.getItem('has_seen_tour_v1');
        if (!seenTour && location.pathname === '/agenda') {
            // Optional: startAgendaTour();
            // For now, we leave it manual via the help button to be less intrusive
        }
    }, [location]);

    const handleStartTour = () => {
        if (location.pathname.includes('/agenda')) {
            startAgendaTour();
        } else if (location.pathname.includes('/patients') || location.pathname.includes('/treatments')) {
            startPatientTour();
        } else {
            // Default generic message or redirect to agenda tour
            const genericDriver = driver({
                showProgress: true,
                steps: [
                    { popover: { title: 'Ayuda', description: 'Navega a la Agenda o Pacientes para ver tutoriales específicos.' } }
                ]
            });
            genericDriver.drive();
        }
    };

    return (
        <button
            onClick={handleStartTour}
            className="fixed bottom-6 right-6 w-12 h-12 bg-ios-blue text-white rounded-full shadow-ios-lg flex items-center justify-center hover:bg-ios-blue/90 transition-all z-50 animate-bounce-subtle"
            title="Iniciar Tutorial"
        >
            <HelpCircle className="w-6 h-6" />
        </button>
    );
};
