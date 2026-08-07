jest.mock('../../src/models/Place');

const Place = require('../../src/models/Place');
const placeService = require('../../src/services/placeService');

describe('PlaceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPlaces()', () => {
    it('should return all places without filters', async () => {
      const mockPlaces = [
        { _id: '1', name: 'Hospital A', type: 'hospital' },
        { _id: '2', name: 'School B', type: 'school' },
      ];
      Place.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockPlaces),
      });

      const result = await placeService.getPlaces({});

      expect(result.places).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should apply type filter', async () => {
      Place.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      });

      await placeService.getPlaces({ type: 'hospital' });

      expect(Place.find).toHaveBeenCalledWith(expect.objectContaining({ type: 'hospital' }));
    });

    it('should apply isActive filter', async () => {
      Place.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      });

      await placeService.getPlaces({ isActive: 'true' });

      expect(Place.find).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));
    });
  });

  describe('getPlaceById()', () => {
    it('should throw if place not found', async () => {
      Place.findById.mockResolvedValue(null);

      await expect(placeService.getPlaceById('nonexistent')).rejects.toThrow('Place not found.');
    });

    it('should return place if found', async () => {
      const mockPlace = { _id: '1', name: 'Hospital A' };
      Place.findById.mockResolvedValue(mockPlace);

      const result = await placeService.getPlaceById('1');
      expect(result).toEqual(mockPlace);
    });
  });

  describe('createPlace()', () => {
    it('should create and return new place', async () => {
      const placeData = {
        name: 'New Hospital',
        type: 'hospital',
        address: '123 Street',
        latitude: 16.05,
        longitude: 108.2,
        description: 'Main hospital',
        phone: '0901234567',
      };
      Place.create.mockResolvedValue({ _id: 'place1', ...placeData });

      const result = await placeService.createPlace(placeData);

      expect(result._id).toBe('place1');
      expect(Place.create).toHaveBeenCalledWith(placeData);
    });
  });

  describe('updatePlace()', () => {
    it('should throw if place not found', async () => {
      Place.findById.mockResolvedValue(null);

      await expect(
        placeService.updatePlace('nonexistent', { name: 'Updated' })
      ).rejects.toThrow('Place not found.');
    });

    it('should update and return place', async () => {
      const updatedPlace = {
        _id: '1',
        name: 'Hospital',
        save: jest.fn().mockResolvedValue(undefined),
      };
      Place.findById.mockResolvedValue(updatedPlace);

      const result = await placeService.updatePlace('1', { name: 'Updated Hospital' });

      expect(result.name).toBe('Updated Hospital');
      expect(Place.findById).toHaveBeenCalledWith('1');
      expect(updatedPlace.save).toHaveBeenCalledTimes(1);
    });

    // Hồi quy: Object.assign(place, req.body) cho client gán geo trực tiếp,
    // làm toạ độ GeoJSON lệch khỏi latitude/longitude.
    it('should ignore fields outside the whitelist', async () => {
      const place = {
        _id: '1',
        name: 'Hospital',
        latitude: 16.05,
        longitude: 108.2,
        geo: { type: 'Point', coordinates: [108.2, 16.05] },
        save: jest.fn().mockResolvedValue(undefined),
      };
      Place.findById.mockResolvedValue(place);

      const result = await placeService.updatePlace('1', {
        name: 'Updated Hospital',
        geo: { type: 'Point', coordinates: [0, 0] },
        _id: 'hacked',
        createdAt: new Date(0),
      });

      expect(result.name).toBe('Updated Hospital');
      expect(result.geo.coordinates).toEqual([108.2, 16.05]);
      expect(result._id).toBe('1');
      expect(result.createdAt).toBeUndefined();
    });

    it('should apply isActive and coordinate updates', async () => {
      const place = {
        _id: '1',
        latitude: 16.05,
        longitude: 108.2,
        isActive: true,
        save: jest.fn().mockResolvedValue(undefined),
      };
      Place.findById.mockResolvedValue(place);

      const result = await placeService.updatePlace('1', {
        latitude: 21.03,
        longitude: 105.85,
        isActive: false,
      });

      expect(result.latitude).toBe(21.03);
      expect(result.longitude).toBe(105.85);
      expect(result.isActive).toBe(false);
    });
  });

  describe('deletePlace()', () => {
    it('should throw if place not found', async () => {
      Place.findByIdAndDelete.mockResolvedValue(null);

      await expect(placeService.deletePlace('nonexistent')).rejects.toThrow('Place not found.');
    });

    it('should delete and return place', async () => {
      const mockPlace = { _id: '1', name: 'Deleted' };
      Place.findByIdAndDelete.mockResolvedValue(mockPlace);

      const result = await placeService.deletePlace('1');
      expect(result).toEqual(mockPlace);
    });
  });
});
