import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { WinstonInstrumentation } from '@opentelemetry/instrumentation-winston'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { getNodeAutoInstrumentations, getResourceDetectors } from '@opentelemetry/auto-instrumentations-node'
import { TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-node'

import { OptionalService, unsafeIsEnabled } from '@models/services.js'

let sdk: NodeSDK | undefined = undefined

// Use the unsafe method to determine if the service is enabled, because
// this method has less dependencies and is thus less error prone when
// using in an instrumentation context.
if (unsafeIsEnabled(OptionalService.DistributedTracing)) {
    const logExporter = new OTLPLogExporter({
        url: process.env.NT_DLOG_URL!,
    })

    const traceExporter = new OTLPTraceExporter({
        url: process.env.NT_DTRACE_URL!,
    })

    sdk = new NodeSDK({
        resource: resourceFromAttributes({
            [ATTR_SERVICE_NAME]: process.env.NT_DTRACE_SERVICE_NAME!,
        }),
        resourceDetectors: getResourceDetectors(),
        sampler: new TraceIdRatioBasedSampler(1.0),
        traceExporter,
        logRecordProcessors: [new BatchLogRecordProcessor({ exporter: logExporter})],
        instrumentations: [getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-net': { enabled: false }
        }), new WinstonInstrumentation({})]
    })

    sdk.start()

    process.on('SIGTERM', () => {
        sdk!
            .shutdown()
            .then(() => console.log('OpenTelemetry SDK shut down successfully'))
            .catch((error) => console.error('Error shutting down SDK', error))
            .finally(() => process.exit(0))
    })
}

export default sdk
