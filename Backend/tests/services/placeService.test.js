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
      Place.findByIdAndUpdate.mockResolvedValue(null);

      await expect(
        placeService.updatePlace('nonexistent', { name: 'Updated' })
      ).rejects.toThrow('Place not found.');
    });

    it('should update and return place', async () => {
      const updatedPlace = { _id: '1', name: 'Updated Hospital' };
      Place.findByIdAndUpdate.mockResolvedValue(updatedPlace);

      const result = await placeService.updatePlace('1', { name: 'Updated Hospital' });

      expect(result.name).toBe('Updated Hospital');
      expect(Place.findByIdAndUpdate).toHaveBeenCalledWith(
        '1',
        { name: 'Updated Hospital' },
        { new: true, runValidators: true }
      );
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
