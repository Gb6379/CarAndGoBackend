import { Injectable } from '@nestjs/common';

export interface RoutePoint {
  latitude: number;
  longitude: number;
  timestamp: Date;
  address?: string;
}

export interface Route {
  origin: RoutePoint;
  destination: RoutePoint;
  waypoints?: RoutePoint[];
  distance: number; // in kilometers
  duration: number; // in minutes
  routePoints: RoutePoint[];
}

export interface RoutePlanningRequest {
  originLatitude: number;
  originLongitude: number;
  destinationLatitude: number;
  destinationLongitude: number;
  originAddress?: string;
  destinationAddress?: string;
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  optimizeForTime?: boolean;
}

@Injectable()
export class RoutePlanningService {
  private readonly EARTH_RADIUS_KM = 6371;

  /**
   * Calculate distance between two points using Haversine formula
   */
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return this.EARTH_RADIUS_KM * c;
  }

  /**
   * Plan a route between origin and destination
   * This is a simplified implementation - in production, you would integrate with Google Maps API
   */
  async planRoute(request: RoutePlanningRequest): Promise<Route> {
    const { originLatitude, originLongitude, destinationLatitude, destinationLongitude } = request;

    // Calculate straight-line distance
    const distance = this.calculateDistance(
      originLatitude,
      originLongitude,
      destinationLatitude,
      destinationLongitude
    );

    // Estimate duration based on distance (assuming average speed of 40 km/h in city)
    const duration = Math.round((distance / 40) * 60); // in minutes

    // Generate route points (simplified - in production use Google Maps API)
    const routePoints = this.generateRoutePoints(
      originLatitude,
      originLongitude,
      destinationLatitude,
      destinationLongitude,
      Math.max(3, Math.floor(distance / 10)) // More points for longer distances
    );

    return {
      origin: {
        latitude: originLatitude,
        longitude: originLongitude,
        address: request.originAddress,
        timestamp: new Date(),
      },
      destination: {
        latitude: destinationLatitude,
        longitude: destinationLongitude,
        address: request.destinationAddress,
        timestamp: new Date(),
      },
      distance,
      duration,
      routePoints,
    };
  }

  /**
   * Optimize route for multiple waypoints
   */
  async optimizeRoute(waypoints: RoutePoint[]): Promise<RoutePoint[]> {
    if (waypoints.length <= 2) {
      return waypoints;
    }

    // Simple optimization - sort by distance from origin
    // In production, use proper TSP (Traveling Salesman Problem) algorithm
    const origin = waypoints[0];
    const destination = waypoints[waypoints.length - 1];
    const middlePoints = waypoints.slice(1, -1);

    // Sort middle points by distance from origin
    middlePoints.sort((a, b) => {
      const distA = this.calculateDistance(
        origin.latitude,
        origin.longitude,
        a.latitude,
        a.longitude
      );
      const distB = this.calculateDistance(
        origin.latitude,
        origin.longitude,
        b.latitude,
        b.longitude
      );
      return distA - distB;
    });

    return [origin, ...middlePoints, destination];
  }

  /**
   * Check if a location is within a geofence
   */
  isWithinGeofence(
    point: RoutePoint,
    centerLatitude: number,
    centerLongitude: number,
    radiusKm: number
  ): boolean {
    const distance = this.calculateDistance(
      point.latitude,
      point.longitude,
      centerLatitude,
      centerLongitude
    );
    return distance <= radiusKm;
  }

  /**
   * Calculate total route distance
   */
  calculateRouteDistance(routePoints: RoutePoint[]): number {
    if (routePoints.length < 2) {
      return 0;
    }

    let totalDistance = 0;
    for (let i = 0; i < routePoints.length - 1; i++) {
      const current = routePoints[i];
      const next = routePoints[i + 1];
      totalDistance += this.calculateDistance(
        current.latitude,
        current.longitude,
        next.latitude,
        next.longitude
      );
    }

    return totalDistance;
  }

  /**
   * Estimate fuel consumption based on route
   */
  estimateFuelConsumption(
    distance: number,
    vehicleType: string,
    fuelType: string
  ): { fuelNeeded: number; cost: number } {
    // Fuel efficiency by vehicle type (km/liter)
    const fuelEfficiency: { [key: string]: number } = {
      sedan: 12,
      hatchback: 14,
      suv: 10,
      pickup: 9,
      coupe: 11,
      convertible: 10,
      wagon: 13,
      minivan: 11,
    };

    // Fuel prices (R$/liter)
    const fuelPrices: { [key: string]: number } = {
      gasoline: 5.50,
      ethanol: 4.20,
      flex: 4.85,
      diesel: 4.80,
      electric: 0.50, // per kWh
      hybrid: 4.50,
      cng: 3.20,
    };

    const efficiency = fuelEfficiency[vehicleType.toLowerCase()] || 12;
    const fuelNeeded = distance / efficiency;
    const fuelPrice = fuelPrices[fuelType.toLowerCase()] || 5.50;
    const cost = fuelNeeded * fuelPrice;

    return { fuelNeeded, cost };
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private generateRoutePoints(
    startLat: number,
    startLon: number,
    endLat: number,
    endLon: number,
    numPoints: number
  ): RoutePoint[] {
    const points: RoutePoint[] = [];
    
    for (let i = 0; i <= numPoints; i++) {
      const ratio = i / numPoints;
      const lat = startLat + (endLat - startLat) * ratio;
      const lon = startLon + (endLon - startLon) * ratio;
      
      points.push({
        latitude: lat,
        longitude: lon,
        timestamp: new Date(),
      });
    }
    
    return points;
  }
}
