import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { LocatorService } from './locator.service';
import { CreateLocatorDeviceDto } from './dto/create-locator-device.dto';
import { UpdateLocatorDeviceDto } from './dto/update-locator-device.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('locator-devices')
export class LocatorController {
  constructor(private readonly locatorService: LocatorService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() createLocatorDeviceDto: CreateLocatorDeviceDto) {
    return this.locatorService.create(createLocatorDeviceDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.locatorService.findAll();
  }

  @Get('online')
  @UseGuards(JwtAuthGuard)
  getOnlineDevices() {
    return this.locatorService.getOnlineDevices();
  }

  @Get('status/:status')
  @UseGuards(JwtAuthGuard)
  getDevicesByStatus(@Param('status') status: string) {
    return this.locatorService.getDevicesByStatus(status as any);
  }

  @Get('vehicle/:vehicleId')
  @UseGuards(JwtAuthGuard)
  findByVehicle(@Param('vehicleId') vehicleId: string) {
    return this.locatorService.findByVehicle(vehicleId);
  }

  @Get('device/:deviceId')
  @UseGuards(JwtAuthGuard)
  findByDeviceId(@Param('deviceId') deviceId: string) {
    return this.locatorService.findByDeviceId(deviceId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.locatorService.findOne(id);
  }

  @Get(':id/status')
  @UseGuards(JwtAuthGuard)
  getDeviceStatus(@Param('id') id: string) {
    return this.locatorService.getDeviceStatus(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() updateLocatorDeviceDto: UpdateLocatorDeviceDto) {
    return this.locatorService.update(id, updateLocatorDeviceDto);
  }

  @Post(':id/install')
  @UseGuards(JwtAuthGuard)
  installDevice(@Param('id') id: string, @Body() installationData: any) {
    return this.locatorService.installDevice(id, installationData);
  }

  @Post(':id/activate')
  @UseGuards(JwtAuthGuard)
  activateDevice(@Param('id') id: string) {
    return this.locatorService.activateDevice(id);
  }

  @Post(':id/deactivate')
  @UseGuards(JwtAuthGuard)
  deactivateDevice(@Param('id') id: string) {
    return this.locatorService.deactivateDevice(id);
  }

  @Post('device/:deviceId/location')
  updateLocation(@Param('deviceId') deviceId: string, @Body() locationData: any) {
    return this.locatorService.updateLocation(deviceId, {
      ...locationData,
      timestamp: new Date(),
    });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.locatorService.remove(id);
  }
}
