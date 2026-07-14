import {
  HttpStatus,
  INestApplication,
  UnprocessableEntityException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import helmet from 'helmet';
import compression = require('compression');
import { CustomExceptionFilter } from './utils/exception-filter';
import { ResponseInterceptor } from './utils/response.interceptor';

/**
 * Everything that turns a bare Nest app into *this* API: URI versioning, the
 * validation pipe, the response envelope, the exception filter, and CORS.
 *
 * It lives here rather than inside bootstrap() so the integration tests can build
 * an app that is configured identically. A test that assembles its own pipeline
 * proves only that the test's pipeline works — the guards, the 422 shape and the
 * CORS policy all have to be the ones production actually runs.
 */
export function configureApp(app: INestApplication): void {
  app.enableVersioning({ type: VersioningType.URI });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        const details = errors.map((error) => ({
          property: error.property,
          constraints: error.constraints,
        }));
        return new UnprocessableEntityException({
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          error: 'Unprocessable Entity',
          message: 'Validation failed',
          details,
        });
      },
    }),
  );

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new CustomExceptionFilter());

  app.use(helmet());
  app.use(compression());

  // The single source of CORS truth. An unset ALLOWED_ORIGINS denies cross-origin
  // requests rather than falling open to `*`.
  app.enableCors({
    origin:
      process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()) ?? false,
    credentials: true,
  });
}
