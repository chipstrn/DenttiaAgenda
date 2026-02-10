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
    doc.text("Denttia Agenda", 20, 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("Clínica Dental Especializada", 20, 26);
    doc.text("Tel: (555) 123-4567 | Email: contacto@denttia.com", 20, 31);

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
    doc.text("Generado por Denttia Agenda", pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });

    // Save
    doc.save(`Receta_${data.patientName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
};
