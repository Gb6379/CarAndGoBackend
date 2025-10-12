import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LocatorDevice } from './entities/locator-device.entity';
import { CreateLocatorDeviceDto } from './dto/create-locator-device.dto';
import { UpdateLocatorDeviceDto } from './dto/update-locator-device.dto';
import { DeviceStatus } from './enums/device-status.enum';

@Injectable()
export class LocatorService {
  constructor(
    @InjectRepository(LocatorDevice)
    private locatorDeviceRepository: Repository<LocatorDevice>,
  ) {}

  async create(createLocatorDeviceDto: CreateLocatorDeviceDto): Promise<LocatorDevice> {
    const device = this.locatorDeviceRepository.create(createLocatorDeviceDto);
    return this.locatorDeviceRepository.save(device);
  }

  async findAll(): Promise<LocatorDevice[]> {
    return this.locatorDeviceRepository.find({
      relations: ['vehicle', 'installer'],
    });
  }

  async findOne(id: string): Promise<LocatorDevice> {
    const device = await this.locatorDeviceRepository.findOne({
      where: { id },
      relations: ['vehicle', 'installer'],
    });

    if (!device) {
      throw new NotFoundException('Locator device not found');
    }

    return device;
  }

  async findByVehicle(vehicleId: string): Promise<LocatorDevice | null> {
    return this.locatorDeviceRepository.findOne({
      where: { vehicleId },
      relations: ['vehicle', 'installer'],
    });
  }

  async findByDeviceId(deviceId: string): Promise<LocatorDevice> {
    const device = await this.locatorDeviceRepository.findOne({
      where: { deviceId },
      relations: ['vehicle', 'installer'],
    });

    if (!device) {
      throw new NotFoundException('Locator device not found');
    }

    return device;
  }

  async update(id: string, updateLocatorDeviceDto: UpdateLocatorDeviceDto): Promise<LocatorDevice> {
    const device = await this.findOne(id);
    Object.assign(device, updateLocatorDeviceDto);
    return this.locatorDeviceRepository.save(device);
  }

  async installDevice(
    id: string,
    installationData: {
      vehicleId: string;
      installationLocation: string;
      latitude: number;
      longitude: number;
      installerId: string;
      installerName: string;
      installerLicense: string;
    }
  ): Promise<LocatorDevice> {
    const device = await this.findOne(id);
    
    device.vehicleId = installationData.vehicleId;
    device.installationLocation = installationData.installationLocation;
    device.installationLatitude = installationData.latitude;
    device.installationLongitude = installationData.longitude;
    device.installationDate = new Date();
    device.installerId = installationData.installerId;
    device.installerName = installationData.installerName;
    device.installerLicense = installationData.installerLicense;
    device.status = DeviceStatus.INSTALLED;
    
    return this.locatorDeviceRepository.save(device);
  }

  async activateDevice(id: string): Promise<LocatorDevice> {
    const device = await this.findOne(id);
    
    device.status = DeviceStatus.ACTIVE;
    device.isOnline = true;
    device.lastSeen = new Date();
    
    return this.locatorDeviceRepository.save(device);
  }

  async deactivateDevice(id: string): Promise<LocatorDevice> {
    const device = await this.findOne(id);
    
    device.status = DeviceStatus.INACTIVE;
    device.isOnline = false;
    
    return this.locatorDeviceRepository.save(device);
  }

  async updateLocation(
    deviceId: string,
    locationData: {
      latitude: number;
      longitude: number;
      batteryLevel: number;
      timestamp: Date;
    }
  ): Promise<LocatorDevice> {
    const device = await this.findByDeviceId(deviceId);
    
    device.latitude = locationData.latitude;
    device.longitude = locationData.longitude;
    device.batteryLevel = locationData.batteryLevel;
    device.lastSeen = locationData.timestamp;
    device.isOnline = true;
    
    return this.locatorDeviceRepository.save(device);
  }

  async getDeviceStatus(id: string): Promise<{
    isOnline: boolean;
    batteryLevel: number;
    lastSeen: Date;
    status: DeviceStatus;
  }> {
    const device = await this.findOne(id);
    
    return {
      isOnline: device.isOnline,
      batteryLevel: device.batteryLevel,
      lastSeen: device.lastSeen,
      status: device.status,
    };
  }

  async getDevicesByStatus(status: DeviceStatus): Promise<LocatorDevice[]> {
    return this.locatorDeviceRepository.find({
      where: { status },
      relations: ['vehicle', 'installer'],
    });
  }

  async getOnlineDevices(): Promise<LocatorDevice[]> {
    return this.locatorDeviceRepository.find({
      where: { isOnline: true },
      relations: ['vehicle', 'installer'],
    });
  }

  async remove(id: string): Promise<void> {
    const device = await this.findOne(id);
    await this.locatorDeviceRepository.remove(device);
  }
}
