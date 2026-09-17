import dotenv from 'dotenv';
import path from 'path';

// Ensure backend/.env is loaded regardless of process.cwd() or startup directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import express, { Request, Response } from 'express';
import cors from 'cors';
import { connectDB } from './database/mongodb';
import analysesRouter from './api/analyses';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

async function syncFromCbomkitIfEmpty() {
  try {
    const { Analysis } = await import('./models/analysis');
    const count = await Analysis.countDocuments();
    if (count === 0) {
      console.log('[Sync] No analyses found in database. Checking CBOMKit backend for generated CBOMs...');
      const axios = (await import('axios')).default;
      const res = await axios.get('http://localhost:8081/api/v1/cbom/last/10');
      if (Array.isArray(res.data) && res.data.length > 0) {
        const target = res.data.find((c: any) => c.projectIdentifier && c.projectIdentifier.includes('tecnico-sec')) || res.data[1] || res.data[0];
        if (target && target.bom) {
          const analysisId = 'ECDAT-D7CF2548';
          const { CbomkitAdapter } = await import('./services/cbomkit_adapter');
          const assetCount = await CbomkitAdapter.processOfficialCbom(analysisId, target.bom);
          
          await Analysis.create({
            analysisId,
            applicationName: 'new app',
            targetType: 'source_code',
            repositoryUrl: 'https://github.com/tecnico-sec/java-crypto-functions',
            dataSensitivity: 1,
            businessCriticality: 1,
            dataProtectionDuration: 10,
            threatHorizonYear: 2036,
            quantumRiskHorizon: 10,
            migrationDuration: 2,
            runtimeEnabled: true,
            status: 'COMPLETED',
            detectedCryptoAssetCount: assetCount,
            currentStage: 'COMPLETED',
            stages: {
              discover: {
                status: 'COMPLETED',
                assetCount,
                completedAt: new Date()
              },
              runtime: {
                status: 'COMPLETED'
              }
            }
          });
          console.log(`[Sync] Successfully initialized analysis ${analysisId} with ${assetCount} CBOM assets.`);
        }
      }
    }
  } catch (err) {
    console.warn('[Sync] Could not sync from CBOMKit:', (err as Error).message);
  }
}

// Routes
app.use('/api/analyses', analysesRouter);

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Connect to MongoDB & start server
async function startServer() {
  try {
    await connectDB();
    await syncFromCbomkitIfEmpty();
    app.listen(port, () => {
      console.log(`ECDAT Backend listening at http://localhost:${port}`);
      // Non-blocking sync of existing completed analyses to CBOMKit backend
      syncExistingAnalysesToCbomkit().catch(() => {});
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

async function syncExistingAnalysesToCbomkit() {
  try {
    const { Cbom } = await import('./models/cbom');
    const cbomDocs = await Cbom.find({}, { analysisId: 1, rawJson: 1 }).lean();
    if (!cbomDocs || cbomDocs.length === 0) return;

    const axios = (await import('axios')).default;
    let synced = 0;
    for (const doc of cbomDocs) {
      if (!doc.analysisId || !doc.rawJson) continue;
      try {
        await axios.post(
          `http://localhost:8081/api/v1/cbom/${encodeURIComponent(doc.analysisId)}`,
          doc.rawJson,
          { headers: { 'Content-Type': 'application/json' }, timeout: 2000 }
        );
        synced++;
      } catch {
        // Safe skip on individual item
      }
    }
    if (synced > 0) {
      console.log(`[Sync] Synchronized ${synced} authoritative CBOMs to CBOMKit backend on port 8081.`);
    }
  } catch (err) {
    console.warn('[Sync] Non-blocking notice: Could not sync existing CBOMs to CBOMKit:', (err as Error).message);
  }
}

startServer();
