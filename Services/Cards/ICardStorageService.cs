using CardConjurer.Models.Cards;

namespace CardConjurer.Services.Cards;

public interface ICardStorageService
{
    Task<IReadOnlyList<SavedCardSummary>> ListAsync(CancellationToken cancellationToken = default);

    Task<SavedCardDetails?> GetAsync(string id, CancellationToken cancellationToken = default);

    Task<SavedCardDetails> SaveAsync(SaveServerCardRequest request, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<SavedCardSummary>> ImportLegacyAsync(IEnumerable<LegacySavedCardFileItem> cards, CancellationToken cancellationToken = default);

    Task<bool> DeleteAsync(string id, CancellationToken cancellationToken = default);
}

