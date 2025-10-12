import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for frontend applications
  app.enableCors({
    origin: ['http://localhost:3001', 'http://localhost:3000', 'http://localhost:19006'], // React web app and React Native
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
    exceptionFactory: (errors) => {
      console.error('Validation errors:', errors);
      return new Error('Validation failed');
    },
  }));

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log('=====================================');
  console.log('🚗 CAR AND GO Backend API');
  console.log(`📍 Running on port: ${port}`);
  console.log(`🌐 API URL: http://localhost:${port}`);
  console.log('=====================================');
}

bootstrap();
