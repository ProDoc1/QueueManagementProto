import { FastifyInstance } from 'fastify'
import { HTML } from 'weasyprint'

export async function reportRoutes(app: FastifyInstance) {
  app.get('/reports/export', {
    preHandler: app.requireRole(['system_admin']),
  }, async (request, reply) => {
    const { period } = request.query as { period: string }

    // 1. Run dynamic date window calculations using your postgres aggregates
    const metrics = await app.db.query(`
      SELECT stat_date, tokens_issued, appointments_completed, appointments_cancelled, appointment_no_shows
      FROM statistics 
      WHERE stat_date >= CASE 
        WHEN $1 = 'today' THEN CURRENT_DATE 
        WHEN $1 = 'last-week' THEN CURRENT_DATE - INTERVAL '7 days'
        ELSE CURRENT_DATE - INTERVAL '30 days'
      END
      ORDER BY stat_date DESC
    `, [period])

    // 2. Generate standard HTML string with structural paged CSS rules embedded inline
    const compiledHtml = `
      <html>
        <head>
          <style>
            @page { size: A4; margin: 20mm 15mm; background-color: #0B0F19; }
            body { font-family: sans-serif; color: #E2E8F0; background-color: #0B0F19; }
            .header { border-bottom: 2px solid #1E293B; padding-bottom: 10px; }
            .title { font-size: 18pt; font-weight: bold; color: #3B82F6; }
            .matrix-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .matrix-table th { background: #0E1420; color: #64748B; padding: 10px; text-align: left; }
            .matrix-table td { padding: 10px; border-bottom: 1px solid #1E293B; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">MediQueue Clinical Log Summary</div>
            <p style="font-size: 9pt; color: #64748B;">Timeframe Window Target: ${period.toUpperCase()}</p>
          </div>
          <table class="matrix-table">
            <thead>
              <tr><th>Date</th><th>Tokens Issued</th><th>Completed</th></tr>
            </thead>
            <tbody>
              ${metrics.rows.map(row => `
                <tr>
                  <td>${row.stat_date}</td>
                  <td>${row.tokens_issued}</td>
                  <td style="color: #10B981;">${row.appointments_completed}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `

    // 3. Render clean data-buffers natively and stream to browser downloads seamlessly
    const pdfBuffer = await HTML({ string: compiledHtml }).write_pdf()
    
    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="MediQueue_${period}_Report.pdf"`)
      .send(pdfBuffer)
  })
}