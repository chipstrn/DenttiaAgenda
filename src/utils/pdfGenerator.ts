import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PrescriptionData {
    doctorName: string;
    patientName: string;
    date: string;
    content: string; // Unstructured text containing Diagnosis, Medications, Instructions
}

export const generatePrescriptionPDF = (data: PrescriptionData) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // -- Header --
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text("Sistema de Gestión Clínica", 20, 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("Receta Médica", 20, 26);

    // Line separator
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 35, pageWidth - 20, 35);

    // -- Info Block --
    doc.setFontSize(12);
    doc.setTextColor(60, 60, 60);

    // Doctor
    doc.setFont("helvetica", "bold");
    doc.text("Dr(a). " + data.doctorName, 20, 45);

    // Date (Right aligned)
    doc.setFont("helvetica", "normal");
    const dateStr = format(new Date(data.date), "d 'de' MMMM, yyyy", { locale: es });
    doc.text(dateStr, pageWidth - 20, 45, { align: 'right' });

    // Patient
    doc.text("Paciente: ", 20, 55);
    doc.setFont("helvetica", "bold");
    doc.text(data.patientName, 40, 55);

    // -- Content Body --
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);

    const splitText = doc.splitTextToSize(data.content, pageWidth - 40);
    doc.text(splitText, 20, 70);

    // -- Footer (Signature) --
    const footerY = doc.internal.pageSize.height - 40;

    doc.setDrawColor(0, 0, 0);
    doc.line(pageWidth / 2 - 40, footerY, pageWidth / 2 + 40, footerY); // Signature line

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Firma del Doctor", pageWidth / 2, footerY + 5, { align: 'center' });

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("Generado por KlinikOS", pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });

    // Save
    doc.save(`Receta_${data.patientName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
};

interface ClinicalHistoryData {
    patientName: string;
    dob: string;
    phone: string;
    email: string;
    medicalHistory: {
        conditions: string[];
        allergies: string[];
        notes: string;
    };
    treatments: {
        date: string;
        description: string;
        status: string;
        doctor: string;
    }[];
    notes: {
        date: string;
        author: string;
        content: string;
    }[];
}

export const generateClinicalHistoryPDF = (data: ClinicalHistoryData) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // Header
    doc.setFontSize(18);
    doc.text("Historia Clínica", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generado: ${format(new Date(), "d MMM yyyy HH:mm", { locale: es })}`, 14, 26);

    // Patient Info
    (doc as any).autoTable({
        startY: 35,
        head: [['Información del Paciente']],
        body: [
            [`Nombre: ${data.patientName}`],
            [`Fecha Nacimiento: ${data.dob}`],
            [`Teléfono: ${data.phone}`],
            [`Email: ${data.email}`]
        ],
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 2 }
    });

    // Medical History
    doc.setFontSize(14);
    doc.text("Anamnesis", 14, (doc as any).lastAutoTable.finalY + 15);

    (doc as any).autoTable({
        startY: (doc as any).lastAutoTable.finalY + 20,
        body: [
            ['Padecimientos', data.medicalHistory.conditions.join(', ') || 'Ninguno'],
            ['Alergias', data.medicalHistory.allergies.join(', ') || 'Ninguna'],
            ['Notas Médicas', data.medicalHistory.notes || 'Sin notas adicionales']
        ],
        theme: 'grid',
        headStyles: { fillColor: [66, 133, 244] }
    });

    // Treatments Log
    doc.setFontSize(14);
    doc.text("Historial de Tratamientos", 14, (doc as any).lastAutoTable.finalY + 15);

    (doc as any).autoTable({
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['Fecha', 'Tratamiento', 'Estado', 'Doctor']],
        body: data.treatments.map(t => [
            format(new Date(t.date), "d MMM yyyy", { locale: es }),
            t.description,
            t.status,
            t.doctor
        ]),
        theme: 'striped',
        headStyles: { fillColor: [66, 133, 244] }
    });

    // Clinical Notes
    doc.setFontSize(14);
    doc.text("Notas de Evolución", 14, (doc as any).lastAutoTable.finalY + 15);

    (doc as any).autoTable({
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['Fecha', 'Autor', 'Nota']],
        body: data.notes.map(n => [
            format(new Date(n.date), "d MMM yyyy HH:mm", { locale: es }),
            n.author,
            n.content
        ]),
        columnStyles: { 2: { cellWidth: 100 } }, // Wrap text for note content
        theme: 'grid'
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text('Página ' + i + ' de ' + pageCount, pageWidth - 30, doc.internal.pageSize.height - 10);
        doc.text('Documento Legal - Confidencial', 14, doc.internal.pageSize.height - 10);
    }

    doc.save(`Historia_${data.patientName.replace(/\s+/g, '_')}.pdf`);
};


interface ConsentData {
    patientName: string;
    doctorName: string;
    procedureName: string;
    risks: string;
}

export const generateInformedConsentPDF = (data: ConsentData) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("CONSENTIMIENTO INFORMADO", pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    const text = `
    Yo, ${data.patientName}, mayor de edad, actuando en mi propio nombre (o como representante legal), declaro que he sido informado(a) detalladamente por el Dr(a). ${data.doctorName} sobre el procedimiento odontológico denominado:
    
    ${data.procedureName.toUpperCase()}
    
    He comprendido la naturaleza, propósito, beneficios y riesgos del tratamiento. Se me ha explicado que la odontología no es una ciencia exacta y que no se pueden garantizar resultados.
    
    RIESGOS ESPECÍFICOS Y COMPLICACIONES POSIBLES:
    ${data.risks || "Infección, inflamación, dolor postoperatorio, sangrado, reacciones alérgicas a medicamentos o anestesia, parestesia temporal o permanente."}
    
    He tenido la oportunidad de hacer preguntas y todas han sido respondidas a mi entera satisfacción. Doy mi consentimiento libre y voluntario para la realización de este procedimiento.
    `.trim();

    const splitText = doc.splitTextToSize(text, pageWidth - 40);
    doc.text(splitText, 20, 40);

    // Signatures
    const ySign = pageHeight - 60;

    doc.line(30, ySign, 90, ySign);
    doc.text("Firma del Paciente", 60, ySign + 5, { align: 'center' });
    doc.text(data.patientName, 60, ySign + 10, { align: 'center', maxWidth: 50 });

    doc.line(120, ySign, 180, ySign);
    doc.text("Firma del Doctor", 150, ySign + 5, { align: 'center' });
    doc.text(data.doctorName, 150, ySign + 10, { align: 'center', maxWidth: 50 });

    // Digital Stamp
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    const stamp = `Firmado digitalmente en KlinikOS | ${format(new Date(), "yyyy-MM-dd HH:mm:ss", { locale: es })} | Hash: ${Math.random().toString(36).substring(7).toUpperCase()}`;
    doc.text(stamp, pageWidth / 2, pageHeight - 10, { align: 'center' });

    doc.save(`Consentimiento_${data.patientName.replace(/\s+/g, '_')}.pdf`);
};
